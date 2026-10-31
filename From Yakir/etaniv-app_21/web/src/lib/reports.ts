import * as XLSX from 'xlsx';
import { money, dmy } from './finance';

export type Col = { h: string; t: 'text' | 'num' | 'date' };
export type Table = { heading: string; columns: Col[]; rows: (string | number)[][]; footer?: (string | number)[] };
export type Kpi = { label: string; value: string; cls?: string };
export type ReportModel = { key: string; title: string; subtitle: string; file: string; kpis: Kpi[]; tables: Table[] };

const T = (h: string): Col => ({ h, t: 'text' });
const NUM = (h: string): Col => ({ h, t: 'num' });
const DATE = (h: string): Col => ({ h, t: 'date' });
export const fmtCell = (col: Col, v: string | number) =>
  col.t === 'num' ? (typeof v === 'number' ? money(v) : v || '')
  : col.t === 'date' ? (v ? dmy(String(v)) : '')
  : v;

// ---------- model builders (from server data) ----------
export function buildProject(d: any): ReportModel {
  const util = d.project.costBudget ? (d.cost / d.project.costBudget) * 100 : 0;
  const pc = d.profit >= 0 ? 'pos' : 'neg';
  return {
    key: 'project', title: 'דוח חיתוך פרויקט', subtitle: `${d.project.code} · ${d.project.name}`, file: `דוח_חיתוך_${d.project.code}`,
    kpis: [
      { label: 'הכנסה מוכרת', value: money(d.income) },
      { label: 'סה"כ עלות', value: money(d.cost) },
      { label: 'רווח גולמי', value: money(d.profit), cls: pc },
      { label: 'שיעור רווח', value: d.margin.toFixed(1) + '%', cls: pc },
      { label: 'ניצול תקציב עלות', value: util.toFixed(0) + '%' },
    ],
    tables: [
      { heading: 'פירוט הכנסות', columns: [T('מסמך'), T('לקוח'), DATE('תאריך'), NUM('לפני מע"מ'), NUM('מע"מ'), NUM('כולל מע"מ'), NUM('נגבה'), NUM('יתרה פתוחה'), T('סטטוס')],
        rows: d.incomeDocs.map((x: any) => [x.number, x.customer, x.date, x.base, x.vat, x.gross, x.paid, x.open, x.status]),
        footer: ['סה"כ', '', '', d.income, '', '', '', '', ''] },
      { heading: 'הוצאות — חומרים וקבלנים', columns: [T('סוג הוצאה'), NUM('סכום'), T('% מההוצאה')],
        rows: d.materials.map((m: any) => [m.type, m.amount, (d.cost ? (m.amount / d.cost) * 100 : 0).toFixed(1) + '%']),
        footer: ['סה"כ', d.matTotal, ''] },
      { heading: 'הוצאות — עבודה', columns: [T('עובד'), T('תפקיד'), NUM('ימים'), NUM('עלות יומית'), NUM('עלות')],
        rows: d.labor.map((l: any) => [l.name, l.role, l.days, l.dailyCost, l.total]),
        footer: ['סה"כ', '', '', '', d.labTotal] },
      { heading: 'ביצוע מול תקציב', columns: [T('מדד'), NUM('תקציב / חוזה'), NUM('בפועל'), NUM('יתרה'), T('ניצול')],
        rows: [
          ['עלות פרויקט', d.project.costBudget, d.cost, d.project.costBudget - d.cost, util.toFixed(0) + '%'],
          ['הכנסה מול חוזה', d.contractVal, d.income, d.contractVal - d.income, (d.contractVal ? (d.income / d.contractVal) * 100 : 0).toFixed(0) + '%'],
          ['גבייה מול חיוב', d.billedGross, d.collected, d.billedGross - d.collected, (d.billedGross ? (d.collected / d.billedGross) * 100 : 0).toFixed(0) + '%'],
        ] },
    ],
  };
}

export function buildSummary(d: any): ReportModel {
  const t = d.totals;
  return {
    key: 'summary', title: 'סיכום כל הפרויקטים', subtitle: `${d.rows.length} פרויקטים · תמונת רווחיות כוללת`, file: 'סיכום_פרויקטים',
    kpis: [
      { label: 'הכנסה מוכרת', value: money(t.income) },
      { label: 'סה"כ עלות', value: money(t.cost) },
      { label: 'רווח גולמי', value: money(t.profit), cls: t.profit >= 0 ? 'pos' : 'neg' },
      { label: 'שיעור רווח', value: t.margin.toFixed(1) + '%', cls: t.profit >= 0 ? 'pos' : 'neg' },
    ],
    tables: [{
      heading: 'רווחיות לפי פרויקט',
      columns: [T('פרויקט'), NUM('הכנסה מוכרת'), NUM('חומרים/קבלנים'), NUM('עבודה'), NUM('סה"כ עלות'), NUM('רווח'), T('שיעור רווח'), NUM('תקציב עלות'), T('ניצול')],
      rows: d.rows.map((r: any) => [`${r.code} · ${r.name}`, r.income, r.materials, r.labor, r.cost, r.profit, r.margin.toFixed(1) + '%', r.budget, r.utilization.toFixed(0) + '%']),
      footer: ['סה"כ', t.income, t.materials, t.labor, t.cost, t.profit, t.margin.toFixed(1) + '%', t.budget, t.utilization.toFixed(0) + '%'],
    }],
  };
}

export function buildAging(d: any): ReportModel {
  return {
    key: 'aging', title: 'דוח גיול חובות', subtitle: 'יתרות פתוחות ללקוחות', file: 'דוח_גיול_חובות',
    kpis: [
      { label: 'סה"כ חוב פתוח', value: money(d.totalOpen) },
      { label: 'מתוכו בפיגור', value: money(d.overdueTotal), cls: 'neg' },
      { label: 'מספר חובות', value: String(d.items.length) },
    ],
    tables: [
      { heading: 'סיכום לפי סבב גיול', columns: [T('סבב'), NUM('מספר חובות'), NUM('סכום')],
        rows: d.buckets.map((b: any) => [b.label, b.count, b.total]), footer: ['סה"כ', d.items.length, d.totalOpen] },
      { heading: 'פירוט חובות פתוחים', columns: [T('לקוח'), T('פרויקט'), T('מסמך'), NUM('נטו'), NUM('נגבה'), NUM('יתרה פתוחה'), DATE('לתשלום עד'), NUM('ימי פיגור'), T('סבב')],
        rows: d.items.map((i: any) => [i.customer, i.project, i.number, i.net, i.paid, i.open, i.dueDate, i.daysOverdue, i.bucketLabel]),
        footer: ['סה"כ', '', '', '', '', d.totalOpen, '', '', ''] },
    ],
  };
}

export function buildCashflow(d: any): ReportModel {
  const t = d.totals;
  return {
    key: 'cashflow', title: 'דוח תזרים מזומנים', subtitle: 'יומן כרונולוגי — כל תנועות ההוצאה וההכנסה', file: 'דוח_תזרים',
    kpis: [
      { label: 'יתרת פתיחה', value: money(d.opening) },
      { label: 'סה"כ הכנסות', value: money(t.income), cls: 'pos' },
      { label: 'סה"כ הוצאות', value: money(t.expense), cls: 'neg' },
      { label: 'יתרת סגירה', value: money(t.closing), cls: t.closing >= 0 ? 'pos' : 'neg' },
    ],
    tables: [
      {
        heading: 'תנועות תזרים (בסדר כרונולוגי)',
        columns: [DATE('תאריך בפועל'), DATE('תאריך ערך'), T('סעיף'), T('לקוח/ספק'), T('אסמכתא'), T('תיאור'), T('פרויקט'), T('סטטוס'), NUM('הוצאות'), NUM('הכנסות'), NUM('יתרה')],
        rows: (d.ledger || []).map((r: any) => [r.actualDate || '', r.valueDate || '', r.category, r.name, r.reference, r.description, r.project, r.status, r.expense || '', r.income || '', r.balance]),
        footer: ['סה"כ', '', '', '', '', '', '', '', t.expense, t.income, t.closing],
      },
    ],
  };
}

// ---------- exports ----------
export type ExportCtx = { producedBy: string; today: string; logo: string };

export function modelToHTML(m: ReportModel, ctx: ExportCtx): string {
  const cs = 'border:1px solid #d0d7e2;padding:6px 9px;text-align:right;';
  const td = (col: Col, v: string | number) => `<td style="${cs}${col.t === 'num' ? 'font-variant-numeric:tabular-nums;' : ''}">${fmtCell(col, v)}</td>`;
  const th = (c: Col) => `<th style="border:1px solid #d0d7e2;padding:7px 9px;background:#eef2f7;text-align:right">${c.h}</th>`;
  let b = `<table style="border:none;margin-bottom:10px;border-bottom:2px solid #1f5f8b;width:100%"><tr style="border:none">
    <td style="border:none;padding:0 0 10px 0;vertical-align:top"><h1 style="font-size:20px;margin:0 0 2px;color:#1f5f8b">${m.title}</h1>
      ${m.subtitle ? `<div style="font-size:15px;font-weight:700">${m.subtitle}</div>` : ''}
      <div style="color:#6b7688;font-size:12px">תאריך הפקה: ${ctx.today} &nbsp;·&nbsp; הופק ע"י: ${ctx.producedBy}</div></td>
    <td style="border:none;padding:0 0 10px 0;text-align:left;vertical-align:top;width:230px">${ctx.logo ? `<img src="${ctx.logo}" alt="אתניב" style="height:52px;width:auto">` : ''}</td></tr></table>`;
  if (m.kpis.length) b += '<table style="width:100%;border-collapse:collapse;margin:0 0 14px"><tr>' + m.kpis.map((k) => `<td style="border:1px solid #d0d7e2;padding:8px 10px;text-align:right">${k.label}<br><b>${k.value}</b></td>`).join('') + '</tr></table>';
  for (const t of m.tables) {
    b += `<h2 style="font-size:15px;margin:18px 0 8px;border-right:4px solid #1f5f8b;padding-right:8px">${t.heading}</h2>`;
    b += '<table style="border-collapse:collapse;width:100%;font-size:12.5px;margin-bottom:6px;direction:rtl"><tr>' + t.columns.map(th).join('') + '</tr>';
    b += t.rows.map((r) => '<tr>' + r.map((v, i) => td(t.columns[i], v)).join('') + '</tr>').join('');
    if (t.footer) b += '<tr>' + t.footer.map((v, i) => `<td style="${cs}font-weight:700;background:#f4f6f9">${v === '' ? '' : fmtCell(t.columns[i], v)}</td>`).join('') + '</tr>';
    b += '</table>';
  }
  b += `<p style="color:#6b7688;font-size:12px;margin-top:18px;border-top:1px solid #d0d7e2;padding-top:10px">© 2026 אתניב ב.י בע"מ. כל הזכויות שמורות. מסמך זה והנתונים בו קניינה הרוחני הבלעדי של אתניב ב.י בע"מ, סודי ומיועד למורשים בלבד.</p>`;
  return `<html dir="rtl" lang="he"><head><meta charset="utf-8"><style>body{font-family:'Segoe UI',Arial,sans-serif;color:#1a2332;padding:8px;direction:rtl;text-align:right}</style></head><body>${b}</body></html>`;
}

function sanitizeSheet(name: string, used: Set<string>) {
  let n = (name || 'גיליון').replace(/[:\\/?*[\]]/g, ' ').slice(0, 28).trim() || 'גיליון';
  const base = n; let i = 2;
  while (used.has(n)) { n = `${base} ${i}`; i++; }
  used.add(n);
  return n;
}

export function exportExcel(m: ReportModel, ctx: ExportCtx) {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  const hdr = [['אתניב ב.י בע"מ · טכנולוגיות מים וסביבה'], [m.title + (m.subtitle ? ' — ' + m.subtitle : '')], [`תאריך הפקה: ${ctx.today}    |    הופק ע"י: ${ctx.producedBy}`], []];
  // תאריכים מיוצאים כ-DD/MM/YYYY; מספרים נשארים מספריים לחישוב באקסל
  const cell = (col: Col, v: string | number) => (col.t === 'date' ? (v ? dmy(String(v)) : '') : v);
  m.tables.forEach((t, idx) => {
    const aoa: (string | number)[][] = hdr.map((r) => r.slice());
    if (idx === 0) { m.kpis.forEach((k) => aoa.push([k.label, k.value])); aoa.push([]); }
    aoa.push(t.columns.map((c) => c.h));
    t.rows.forEach((r) => aoa.push(r.map((v, ci) => cell(t.columns[ci], v))));
    if (t.footer) aoa.push(t.footer.map((v, ci) => (v === '' ? '' : cell(t.columns[ci], v))));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sanitizeSheet(t.heading, used));
  });
  XLSX.writeFile(wb, m.file + '.xlsx');
}

export function exportWord(m: ReportModel, ctx: ExportCtx) {
  const blob = new Blob(['﻿' + modelToHTML(m, ctx)], { type: 'application/msword' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = m.file + '.doc';
  a.click();
  URL.revokeObjectURL(a.href);
}

export function exportPDF(m: ReportModel, ctx: ExportCtx) {
  const w = window.open('', '_blank');
  if (!w) { alert('הדפדפן חסם חלון קופץ — אשר פתיחת חלונות'); return; }
  w.document.write(modelToHTML(m, ctx) + '<' + 'script>window.onload=function(){window.print();}<' + '/script>');
  w.document.close();
}

export function sendOutlook(m: ReportModel, ctx: ExportCtx) {
  const subj = m.title + (m.subtitle ? ' · ' + m.subtitle : '');
  let body = `שלום,\n\nמצורף ${m.title} (נכון ל-${ctx.today}):\n\n`;
  m.kpis.forEach((k) => { body += `• ${k.label}: ${k.value}\n`; });
  body += `\nנא לצרף את קובץ הדוח (Excel/Word/PDF) שהופק מהמערכת.\n\nבברכה,\n${ctx.producedBy}\nאתניב ב.י בע"מ`;
  window.open(`https://outlook.office.com/mail/deeplink/compose?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`, '_blank');
}

// ---------- מס"ב (מקבץ תשלומים לספקים) ----------
export type MasavField = { pos: string; len: number; name: string; sample: string };
export type MasavRecord = { type: string; name: string; fields: MasavField[] };
export type MasavResp = { filename: string; content: string; count: number; total: number; preview: { runDate: string; supplier: string; invoiceNo: string; bank: string; amount: number }[]; warnings: string[]; placeholder: boolean; institutionCode?: string; senderName?: string; spec?: { lineLength: number; records: MasavRecord[] } };

// הורדת קובץ טקסט (קובץ המס"ב)
export function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ייצוא הפירוט של מקבץ התשלומים לאקסל (לקריאה אנושית לצד קובץ המס"ב)
export function exportMasavExcel(m: MasavResp, from: string, to: string, ctx: ExportCtx) {
  const model: ReportModel = {
    key: 'masav', title: 'מקבץ תשלומים לספקים (מס"ב)', subtitle: `טווח מועדי תשלום: ${dmy(from)}–${dmy(to)}`, file: `מקבץ_תשלומים_${from}_${to}`,
    kpis: [{ label: 'מספר תשלומים', value: String(m.count) }, { label: 'סכום כולל', value: money(m.total) }],
    tables: [{
      heading: 'פירוט התשלומים בקובץ',
      columns: [DATE('מועד תשלום'), T('ספק'), T('מס\' חשבונית'), T('בנק-סניף-חשבון'), NUM('סכום')],
      rows: m.preview.map((p) => [p.runDate, p.supplier, p.invoiceNo, p.bank, p.amount]),
      footer: ['סה"כ', '', '', '', m.total],
    }],
  };
  exportExcel(model, ctx);
}

// לוגו כ-data URL (לשיבוץ ב-Word/PDF)
let logoCache: string | null = null;
export async function getLogoDataUrl(): Promise<string> {
  if (logoCache !== null) return logoCache;
  try {
    const res = await fetch('/logo.png');
    const blob = await res.blob();
    logoCache = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.readAsDataURL(blob);
    });
  } catch {
    logoCache = '';
  }
  return logoCache;
}
