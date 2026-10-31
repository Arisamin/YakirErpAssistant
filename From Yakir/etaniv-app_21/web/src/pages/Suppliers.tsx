import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { Supplier, SupplierInvoice, Project, InvoiceLine, FieldSetting } from '../types';
import { money, fmt, shotefPlus, dmy, STATUS_CLASS } from '../lib/finance';
import { downloadHashavshevetXlsx } from '../lib/hashavshevet';

const TERMS = ['0', '30', '45', '60', '90'];
const emptyLine = (): InvoiceLine => ({ projectId: '', expenseType: '', amount: 0 });

export default function Suppliers() {
  const { can } = useAuth();
  const canWrite = can('suppliers', 'write');
  const canDelete = can('suppliers', 'delete');

  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<string[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [fieldSettings, setFieldSettings] = useState<FieldSetting[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  // סינון
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fProject, setFProject] = useState('');

  // טופס
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [base, setBase] = useState<number | ''>('');
  const [vatRate, setVatRate] = useState<number>(18);
  const [docKind, setDocKind] = useState<'tax' | 'esek'>('tax');
  const [terms, setTerms] = useState('30');
  const [lines, setLines] = useState<InvoiceLine[]>([emptyLine()]);
  const [approved, setApproved] = useState(false);
  const [recordedHh, setRecordedHh] = useState(false);
  const [inCashflow, setInCashflow] = useState(false);
  const [paid, setPaid] = useState(false);
  const [poNo, setPoNo] = useState('');
  const [dnNo, setDnNo] = useState('');
  const [matched, setMatched] = useState(false);
  const [notes, setNotes] = useState('');
  const [selfNo, setSelfNo] = useState('');
  const [intakeDate, setIntakeDate] = useState('');
  const [actualPayDate, setActualPayDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  // ניהול ספקים ופרטי בנק
  const [supOpen, setSupOpen] = useState(false);
  const [supEdits, setSupEdits] = useState<Record<string, Partial<Supplier>>>({});
  const [supMsg, setSupMsg] = useState('');
  const [supBusy, setSupBusy] = useState('');
  const [supSearch, setSupSearch] = useState('');

  function openSuppliers() {
    const init: Record<string, Partial<Supplier>> = {};
    suppliers.forEach((s) => { init[s.id] = { name: s.name, hhAccountKey: s.hhAccountKey ?? '', taxId: s.taxId ?? '', vatRate: s.vatRate ?? 18, defaultTerms: s.defaultTerms ?? '30', bankCode: s.bankCode ?? '', branchCode: s.branchCode ?? '', bankAccount: s.bankAccount ?? '' }; });
    setSupEdits(init);
    setSupMsg('');
    setSupOpen(true);
  }
  function setSupField(id: string, k: keyof Supplier, v: string) {
    setSupEdits((e) => ({ ...e, [id]: { ...e[id], [k]: v } }));
  }
  async function saveSupplier(id: string) {
    setSupBusy(id); setSupMsg('');
    try {
      const e = supEdits[id] || {};
      await api.updateSupplier(id, { name: e.name, hhAccountKey: e.hhAccountKey, taxId: e.taxId, vatRate: e.vatRate === undefined ? undefined : Number(e.vatRate), defaultTerms: e.defaultTerms, bankCode: e.bankCode, branchCode: e.branchCode, bankAccount: e.bankAccount });
      setSuppliers((ss) => ss.map((s) => (s.id === id ? { ...s, ...e } : s)));
      setSupMsg('✓ נשמר: ' + (e.name || suppliers.find((s) => s.id === id)?.name || ''));
    } catch (err) {
      setSupMsg((err as Error).message || 'שגיאה בשמירה');
    } finally {
      setSupBusy('');
    }
  }
  async function deleteSupplier(id: string) {
    const s = suppliers.find((x) => x.id === id);
    if (!confirm(`למחוק את הספק "${s?.name || ''}"? פעולה זו בלתי הפיכה. (ניתן למחוק רק ספק ללא חשבוניות מקושרות.)`)) return;
    setSupBusy(id); setSupMsg('');
    try {
      await api.deleteSupplier(id);
      setSuppliers((ss) => ss.filter((x) => x.id !== id));
      setSupMsg('✓ הספק נמחק: ' + (s?.name || ''));
    } catch (err) {
      setSupMsg((err as Error).message || 'שגיאה במחיקה');
    } finally {
      setSupBusy('');
    }
  }

  // ייצוא לחשבשבת
  const [hhOpen, setHhOpen] = useState(false);
  const [hhPending, setHhPending] = useState<import('../types').HhPending | null>(null);
  const [hhHistory, setHhHistory] = useState<import('../types').HhBatch[]>([]);
  const [hhMsg, setHhMsg] = useState('');
  const [hhBusy, setHhBusy] = useState(false);

  async function openHh() {
    setHhMsg(''); setHhOpen(true); setHhPending(null);
    try {
      const [p, h] = await Promise.all([api.hhPending(), api.hhHistory()]);
      setHhPending(p); setHhHistory(h);
    } catch (e) { setHhMsg((e as Error).message || 'שגיאה בטעינה'); }
  }
  async function runHhExport() {
    setHhBusy(true); setHhMsg('');
    try {
      const res = await api.hhExport();
      downloadHashavshevetXlsx(res.rows, res.batch);
      setHhMsg(`✓ הופק קובץ לחשבשבת (${res.invoiceCount} חשבוניות, ${res.lineCount} שורות). החשבוניות סומנו כנקלטו.`);
      const [p, h] = await Promise.all([api.hhPending(), api.hhHistory()]);
      setHhPending(p); setHhHistory(h);
      await load();
    } catch (e) { setHhMsg((e as Error).message || 'שגיאה בהפקה'); }
    finally { setHhBusy(false); }
  }
  async function undoHh(batch: string) {
    if (!confirm(`לבטל את אצוות הייצוא ${batch}? החשבוניות יחזרו למצב "ממתין לייצוא".`)) return;
    setHhBusy(true); setHhMsg('');
    try {
      await api.hhUndo(batch);
      const [p, h] = await Promise.all([api.hhPending(), api.hhHistory()]);
      setHhPending(p); setHhHistory(h);
      await load();
      setHhMsg('✓ האצווה בוטלה');
    } catch (e) { setHhMsg((e as Error).message || 'שגיאה בביטול'); }
    finally { setHhBusy(false); }
  }


  async function load() {
    setLoading(true);
    try {
      const [inv, sup, exp, proj, fs] = await Promise.all([
        api.supplierInvoices(),
        api.suppliers(),
        api.expenseTypes(),
        api.projects(),
        api.invoiceFieldSettings(),
      ]);
      setInvoices(inv);
      setSuppliers(sup);
      setExpenseTypes(exp);
      setProjects(proj);
      setFieldSettings(fs);
    } catch (e) {
      setErr((e as Error).message || 'שגיאה בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const projName = (id: string) => {
    const p = projects.find((x) => x.id === id);
    return p ? `${p.code}` : '—';
  };

  const stats = useMemo(() => {
    const pending = invoices.filter((v) => !v.approved).length;
    const toRecord = invoices.filter((v) => v.approved && !v.recordedHh).length;
    const openAmt = invoices.filter((v) => !v.paid).reduce((s, v) => s + v.total, 0);
    return { count: invoices.length, pending, toRecord, openAmt };
  }, [invoices]);

  const rows = invoices.filter((v) => {
    if (q && !(v.supplier?.name.includes(q) || v.invoiceNo.includes(q))) return false;
    if (fStatus && v.status !== fStatus) return false;
    if (fProject && !v.lines.some((l) => l.projectId === fProject)) return false;
    return true;
  });

  // ----- טופס -----
  function openForm(inv?: SupplierInvoice) {
    if (!canWrite) return;
    setFormErr('');
    if (inv) {
      setEditId(inv.id);
      setSupplierId(inv.supplierId);
      setInvoiceNo(inv.invoiceNo);
      setInvoiceDate(inv.invoiceDate);
      setBase(inv.amountBeforeVat);
      setVatRate(inv.vatRate ?? 18);
      setDocKind(inv.docKind ?? 'tax');
      setTerms(inv.terms);
      setLines(inv.lines.length ? inv.lines.map((l) => ({ ...l })) : [emptyLine()]);
      setApproved(inv.approved);
      setRecordedHh(inv.recordedHh);
      setInCashflow(inv.inCashflow);
      setPaid(inv.paid);
      setPoNo(inv.purchaseOrderNo ?? '');
      setDnNo(inv.deliveryNoteNo ?? '');
      setMatched(inv.matched);
      setNotes(inv.notes ?? '');
      setSelfNo(inv.selfInvoiceNo ?? '');
      setIntakeDate(inv.intakeDate ?? '');
      setActualPayDate(inv.actualPayDate ?? '');
    } else {
      setEditId(null);
      setSupplierId('');
      setInvoiceNo('');
      setInvoiceDate(new Date().toISOString().slice(0, 10));
      setBase('');
      setVatRate(18);
      setDocKind('tax');
      setTerms('30');
      setLines([emptyLine()]);
      setApproved(false);
      setRecordedHh(false);
      setInCashflow(false);
      setPaid(false);
      setPoNo('');
      setDnNo('');
      setMatched(false);
      setNotes('');
      setSelfNo('');
      setIntakeDate(new Date().toISOString().slice(0, 10));
      setActualPayDate('');
    }
    setOpen(true);
  }

  function onSupplierChange(id: string) {
    setSupplierId(id);
    const s = suppliers.find((x) => x.id === id);
    if (!s) return;
    if (s.defaultTerms) setTerms(s.defaultTerms);
    if (s.vatRate !== undefined && s.vatRate !== null) setVatRate(s.vatRate);
    setLines((ls) =>
      ls.length === 1 && !ls[0].expenseType && s.defaultExpenseType
        ? [{ ...ls[0], expenseType: s.defaultExpenseType }]
        : ls
    );
  }

  const baseNum = Number(base) || 0;
  const vatAmt = Math.round(baseNum * (Number(vatRate) || 0) / 100);
  const totalAmt = baseNum + vatAmt;
  const assigned = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const balanced = baseNum > 0 && Math.abs(assigned - baseNum) < 1;
  const payDate = shotefPlus(invoiceDate, parseInt(terms, 10));

  // ----- שדות חובה לאישור (ניתן להגדרה ע"י המנהל) -----
  const isRequired = (key: string) => fieldSettings.some((f) => f.fieldKey === key && f.required);
  const fieldFilled = (key: string): boolean => {
    switch (key) {
      case 'purchaseOrderNo': return poNo.trim() !== '';
      case 'deliveryNoteNo': return dnNo.trim() !== '';
      case 'selfInvoiceNo': return selfNo.trim() !== '';
      case 'notes': return notes.trim() !== '';
      case 'matched': return matched;
      case 'lines': return lines.some((l) => l.projectId && Number(l.amount) > 0);
      default: return true;
    }
  };
  const missingRequired = fieldSettings.filter((f) => f.required && !fieldFilled(f.fieldKey));
  const canApprove = missingRequired.length === 0;

  // אם החשבונית אינה עומדת בכל שדות החובה — לא ניתן להשאירה מאושרת
  useEffect(() => {
    if (!canApprove && approved) setApproved(false);
  }, [canApprove, approved]);

  async function save() {
    if (!supplierId || !baseNum) {
      setFormErr('נא לבחור ספק ולמלא סכום');
      return;
    }
    if (approved && !canApprove) {
      setFormErr('לא ניתן לאשר לתשלום — חסרים שדות חובה: ' + missingRequired.map((f) => f.label).join(', '));
      return;
    }
    setSaving(true);
    setFormErr('');
    try {
      const payload = {
        supplierId,
        invoiceNo: invoiceNo || 'חדש',
        invoiceDate,
        intakeDate: intakeDate || undefined,
        docKind,
        amountBeforeVat: baseNum,
        vatRate: Number(vatRate) || 0,
        terms,
        approved,
        recordedHh,
        inCashflow,
        paid,
        actualPayDate: actualPayDate || undefined,
        purchaseOrderNo: poNo,
        deliveryNoteNo: dnNo,
        matched,
        notes,
        selfInvoiceNo: selfNo,
        lines: lines
          .filter((l) => l.projectId && l.amount)
          .map((l) => ({ projectId: l.projectId, expenseType: l.expenseType, amount: Number(l.amount) })),
      };
      if (editId) await api.updateSupplierInvoice(editId, payload);
      else await api.createSupplierInvoice(payload);
      setOpen(false);
      await load();
    } catch (e) {
      setFormErr((e as Error).message || 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editId || !canDelete) return;
    if (!confirm('למחוק את החשבונית?')) return;
    setSaving(true);
    try {
      await api.deleteSupplierInvoice(editId);
      setOpen(false);
      await load();
    } catch (e) {
      setFormErr((e as Error).message || 'שגיאה במחיקה');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="center-msg">טוען…</div>;
  if (err) return <div className="center-msg">{err}</div>;

  return (
    <>
      <div className="row-between">
        <div>
          <h2 className="title">חשבוניות ספקים</h2>
          <p className="sub2">קליטה, סיווג ומעקב חשבוניות ספקים — משויך לפרויקט וסוג הוצאה</p>
        </div>
        {canWrite && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn ghost" onClick={openSuppliers}>🏦 ניהול ספקים ופרטי בנק</button>
            <button className="btn ghost" onClick={openHh}>📤 ייצוא לחשבשבת</button>
            <button className="btn" onClick={() => openForm()}>＋ קליטת חשבונית ספק</button>
          </div>
        )}
      </div>

      {!canWrite && <div className="ro-badge">🔒 צפייה בלבד — אין לך הרשאת עריכה במודול זה</div>}

      <div className="cards">
        <div className="stat"><div className="k">חשבוניות</div><div className="v">{stats.count}</div></div>
        <div className="stat"><div className="k">ממתינות לאישור</div><div className="v" style={{ color: 'var(--warn)' }}>{stats.pending}</div></div>
        <div className="stat"><div className="k">לקליטה בהנה"ח</div><div className="v" style={{ color: '#0f8f9e' }}>{stats.toRecord}</div></div>
        <div className="stat"><div className="k">יתרה פתוחה לתשלום</div><div className="v">{fmt(stats.openAmt)} <small>₪</small></div></div>
      </div>

      <div className="toolbar">
        <div className="grow"><input placeholder="חיפוש ספק / מספר חשבונית…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">כל הסטטוסים</option>
          {Object.keys(STATUS_CLASS).map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={fProject} onChange={(e) => setFProject(e.target.value)}>
          <option value="">כל הפרויקטים</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
        </select>
      </div>

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>ספק</th><th>מס' חשבונית</th><th>פרויקט</th><th>סוג הוצאה</th>
              <th>סכום כולל</th><th>לתשלום</th><th>התאמה</th><th>סטטוס</th><th>הנה"ח / תזרים / שולם</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40 }} className="muted">לא נמצאו חשבוניות</td></tr>
            )}
            {rows.map((v) => {
              const projs = [...new Set(v.lines.map((l) => projName(l.projectId)))];
              const exps = [...new Set(v.lines.map((l) => l.expenseType))];
              return (
                <tr key={v.id} className={canWrite ? 'click' : ''} onClick={() => openForm(v)}>
                  <td className="strong">{v.supplier?.name}</td>
                  <td className="num">{v.invoiceNo}</td>
                  <td>{projs.length ? projs.map((p, i) => <span key={i} className="chip">{p}</span>) : <span className="muted">לא סווג</span>}</td>
                  <td>{exps.length ? exps.map((e, i) => <span key={i} className="chip">{e}</span>) : <span className="muted">—</span>}</td>
                  <td className="num">{money(v.total)}</td>
                  <td className="num">{dmy(v.payDate)}</td>
                  <td>
                    {v.matched
                      ? <span className="badge b-ok" title={`הזמנת רכש: ${v.purchaseOrderNo || '—'} · תעודת משלוח: ${v.deliveryNoteNo || '—'}`}>✔ הותאם</span>
                      : <span className="badge b-warn">ממתין</span>}
                  </td>
                  <td><span className={`badge ${STATUS_CLASS[v.status] || 'b-gray'}`}>{v.status}</span></td>
                  <td>
                    <div className="flags">
                      <span className={`flag ${v.recordedHh ? 'on' : ''}`} title="נקלט בהנה״ח">ח</span>
                      <span className={`flag ${v.inCashflow ? 'on' : ''}`} title="צורף לתזרים">ת</span>
                      <span className={`flag ${v.paid ? 'on' : ''}`} title="שולם">₪</span>
                      <span className={`flag ${v.hhExportedAt ? 'on' : ''}`} title={v.hhExportedAt ? `יוצא לחשבשבת ${dmy(v.hhExportedAt)}` : 'טרם יוצא לחשבשבת'}>H</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal">
            <header>
              <h3>{editId ? 'עריכת חשבונית ספק' : 'קליטת חשבונית ספק'}</h3>
              <button className="x" onClick={() => setOpen(false)}>×</button>
            </header>
            <div className="body">
              {formErr && <div className="err">{formErr}</div>}
              <div className="section-t">פרטי החשבונית</div>
              <div className="grid3">
                <label className="fld"><span>ספק</span>
                  <select value={supplierId} onChange={(e) => onSupplierChange(e.target.value)} style={{ width: '100%' }}>
                    <option value="">בחר ספק…</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {supplierId && (() => {
                    const sup = suppliers.find((s) => s.id === supplierId);
                    const key = sup?.hhAccountKey?.trim();
                    return <span style={{ fontSize: 11, marginTop: 4, display: 'block', color: key ? 'var(--muted)' : 'var(--warn)' }}>
                      מספר ספק (חשבשבת): {key ? <b style={{ color: 'var(--ink)' }}>{key}</b> : 'חסר — הגדר ב"ניהול ספקים"'}
                    </span>;
                  })()}
                </label>
                <label className="fld"><span>מספר חשבונית</span><input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} /></label>
                <label className="fld"><span>תאריך חשבונית</span><input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></label>
              </div>
              <div style={{ marginTop: 14 }}>
                <span className="fld" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>סוג מסמך</span>
                <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                  <button type="button" onClick={() => setDocKind('tax')}
                    style={{ padding: '8px 18px', border: 'none', cursor: 'pointer', fontWeight: 600, background: docKind === 'tax' ? 'var(--brand, #1f6feb)' : 'transparent', color: docKind === 'tax' ? '#fff' : 'var(--ink)' }}>
                    חשבונית מס
                  </button>
                  <button type="button" onClick={() => setDocKind('esek')}
                    style={{ padding: '8px 18px', border: 'none', cursor: 'pointer', fontWeight: 600, background: docKind === 'esek' ? 'var(--brand, #1f6feb)' : 'transparent', color: docKind === 'esek' ? '#fff' : 'var(--ink)' }}>
                    חשבון עסקה
                  </button>
                </div>
                <span style={{ fontSize: 11, marginInlineStart: 12, color: 'var(--muted)' }}>
                  {docKind === 'esek'
                    ? 'חשבון עסקה (פרופורמה) — יוצג בתזרים כתנועה צפויה ולא ייכלל בייצוא לחשבשבת. ניתן להמיר לחשבונית מס מדוח התזרים.'
                    : 'חשבונית מס — נכללת בייצוא לחשבשבת ובמקבץ התשלומים.'}
                </span>
              </div>
              <div className="grid3" style={{ marginTop: 14 }}>
                <label className="fld"><span>לפני מע"מ (₪)</span><input type="number" value={base} onChange={(e) => setBase(e.target.value === '' ? '' : Number(e.target.value))} /></label>
                <label className="fld"><span>מע"מ % <span className="auto-badge">לפי הספק</span></span>
                  <input type="number" value={vatRate} onChange={(e) => setVatRate(e.target.value === '' ? 0 : Number(e.target.value))} />
                  <span style={{ fontSize: 11, marginTop: 4, display: 'block', color: 'var(--muted)' }}>סכום מע"מ: {fmt(vatAmt)} ₪ · 0% = פטור (למשל אילת)</span>
                </label>
                <label className="fld"><span>סה"כ כולל מע"מ <span className="auto-badge">אוטו'</span></span><input value={fmt(totalAmt)} readOnly /></label>
              </div>
              <div className="grid3" style={{ marginTop: 14 }}>
                <label className="fld"><span>תנאי תשלום <span className="auto-badge">לפי הספק</span></span>
                  <select value={terms} onChange={(e) => setTerms(e.target.value)} style={{ width: '100%' }}>
                    {TERMS.map((t) => <option key={t} value={t}>שוטף+{t}</option>)}
                  </select>
                  <span style={{ fontSize: 11, marginTop: 4, display: 'block', color: 'var(--muted)' }}>נמשך אוטומטית מהגדרת הספק — ניתן לשינוי ידני</span>
                </label>
                <label className="fld"><span>תאריך לתשלום (תאריך ערך) <span className="auto-badge">מחושב</span></span><input value={dmy(payDate)} readOnly /></label>
                <label className="fld"><span>תאריך קליטת החשבונית</span><input type="date" value={intakeDate} onChange={(e) => setIntakeDate(e.target.value)} /></label>
              </div>
              <div className="grid3" style={{ marginTop: 14 }}>
                <label className="fld">
                  <span>מספר חשבונית עצמית {isRequired('selfInvoiceNo') && <span className="req-mark">*</span>}</span>
                  <input value={selfNo} onChange={(e) => setSelfNo(e.target.value)} placeholder="לספקים המחייבים חשבונית עצמית" />
                </label>
                <div />
                <div />
              </div>

              <div className="section-t">סיווג לפרויקטים וסוגי הוצאה — ניתן לפצל {isRequired('lines') && <span className="req-mark">*</span>}</div>
              <table className="lines-tbl">
                <thead><tr><th style={{ width: '38%' }}>פרויקט</th><th style={{ width: '32%' }}>סוג הוצאה</th><th style={{ width: '22%' }}>סכום</th><th /></tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td>
                        <select value={l.projectId} onChange={(e) => setLines((ls) => ls.map((x, xi) => xi === i ? { ...x, projectId: e.target.value } : x))}>
                          <option value="">— פרויקט —</option>
                          {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
                        </select>
                      </td>
                      <td>
                        <select value={l.expenseType} onChange={(e) => setLines((ls) => ls.map((x, xi) => xi === i ? { ...x, expenseType: e.target.value } : x))}>
                          <option value="">— סוג —</option>
                          {expenseTypes.map((et) => <option key={et}>{et}</option>)}
                        </select>
                      </td>
                      <td><input type="number" value={l.amount || ''} onChange={(e) => setLines((ls) => ls.map((x, xi) => xi === i ? { ...x, amount: Number(e.target.value) || 0 } : x))} /></td>
                      <td>{lines.length > 1 && <button className="icon-btn" onClick={() => setLines((ls) => ls.filter((_, xi) => xi !== i))}>🗑</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => setLines((ls) => [...ls, emptyLine()])}>＋ שורת סיווג</button>
              <div className={`line-sum ${baseNum > 0 ? (balanced ? 'good' : 'bad') : ''}`}>
                <span>סה"כ משויך</span><span>{fmt(assigned)} / {fmt(baseNum)} (לפני מע"מ)</span>
              </div>

              <div className="section-t">התאמה — הזמנת רכש ותעודת משלוח</div>
              <div className="grid2">
                <label className="fld"><span>מספר הזמנת רכש (שיצאה מאיתנו) {isRequired('purchaseOrderNo') && <span className="req-mark">*</span>}</span><input value={poNo} onChange={(e) => setPoNo(e.target.value)} placeholder="לדוגמה PO-2026-118" /></label>
                <label className="fld"><span>מספר תעודת משלוח (של הספק) {isRequired('deliveryNoteNo') && <span className="req-mark">*</span>}</span><input value={dnNo} onChange={(e) => setDnNo(e.target.value)} placeholder="לדוגמה DN-4471" /></label>
              </div>
              <div className="toggle-row" style={{ marginTop: 12 }}>
                <span>✔ הותאם להזמנת הרכש ולתעודת המשלוח (3-way match) {isRequired('matched') && <span className="req-mark">*</span>}</span>
                <label className="switch"><input type="checkbox" checked={matched} onChange={(e) => setMatched(e.target.checked)} /><span className="slider" /></label>
              </div>

              <div className="section-t">אישור וסטטוס</div>
              {isRequired('lines') || fieldSettings.some((f) => f.required) ? (
                <p className="sub2" style={{ marginTop: -6, marginBottom: 10 }}>
                  שדות המסומנים ב-<span className="req-mark">*</span> הם חובה לאישור החשבונית לתשלום (נקבע ע"י מנהל המערכת).
                </p>
              ) : null}
              <div className="grid2">
                <div className="toggle-row" style={!canApprove ? { opacity: 0.6 } : undefined}>
                  <span>מאושר לתשלום{!canApprove && <span className="muted" style={{ fontWeight: 400, fontSize: 11, display: 'block' }}>חסר: {missingRequired.map((f) => f.label).join(', ')}</span>}</span>
                  <label className="switch"><input type="checkbox" checked={approved} disabled={!canApprove} onChange={(e) => setApproved(e.target.checked)} /><span className="slider" /></label>
                </div>
                <div className="toggle-row"><span>נקלט בהנה"ח</span><label className="switch"><input type="checkbox" checked={recordedHh} onChange={(e) => setRecordedHh(e.target.checked)} /><span className="slider" /></label></div>
                <div className="toggle-row"><span>צורף לתזרים</span><label className="switch"><input type="checkbox" checked={inCashflow} onChange={(e) => setInCashflow(e.target.checked)} /><span className="slider" /></label></div>
                <div className="toggle-row"><span>שולם</span><label className="switch"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /><span className="slider" /></label></div>
              </div>
              <div className="grid2" style={{ marginTop: 14 }}>
                <label className="fld"><span>תאריך תשלום בפועל</span><input type="date" value={actualPayDate} onChange={(e) => setActualPayDate(e.target.value)} /></label>
                <div />
              </div>

              <label className="fld" style={{ marginTop: 16 }}>
                <span>הערות (מלל חופשי) {isRequired('notes') && <span className="req-mark">*</span>}</span>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder='לדוגמה: מאושר לתשלום בכפוף לקיזוז זיכוי' style={{ width: '100%', resize: 'vertical' }} />
              </label>
            </div>
            <footer>
              {editId && canDelete ? <button className="btn ghost" style={{ color: 'var(--red)' }} onClick={remove} disabled={saving}>מחיקה</button> : <span />}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn ghost" onClick={() => setOpen(false)}>ביטול</button>
                <button className="btn" onClick={save} disabled={saving}>{saving ? 'שומר…' : 'שמירה'}</button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {supOpen && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setSupOpen(false)}>
          <div className="modal">
            <header>
              <h3>ניהול ספקים ופרטי בנק</h3>
              <button className="x" onClick={() => setSupOpen(false)}>×</button>
            </header>
            <div className="body">
              <p className="sub2" style={{ marginTop: 0, fontSize: 12 }}>
                "מספר ספק (חשבשבת)" = מפתח החשבון בחשבשבת — נמשך אוטומטית בעת בחירת הספק בטופס החשבונית. "תנאי תשלום" ו"מע"מ %" נמשכים אוטומטית לטופס (מע"מ 0% = ספק פטור, למשל אילת). פרטי הבנק משמשים להפקת קובץ מס"ב.
              </p>
              <div className="toolbar" style={{ marginBottom: 10 }}>
                <div className="grow"><input placeholder="חיפוש ספק לפי שם / מספר…" value={supSearch} onChange={(e) => setSupSearch(e.target.value)} /></div>
                <span className="sub2" style={{ margin: 0, fontSize: 12 }}>{suppliers.length} ספקים</span>
              </div>
              <div className="panel" style={{ boxShadow: 'none', maxHeight: '52vh', overflow: 'auto' }}>
                <table>
                  <thead><tr><th>שם ספק</th><th>מספר ספק (חשבשבת)</th><th>מע"מ %</th><th>תנאי תשלום</th><th>ח.פ / ע.מ</th><th>קוד בנק</th><th>סניף</th><th>מספר חשבון</th><th></th></tr></thead>
                  <tbody>
                    {suppliers.filter((s) => { const q = supSearch.trim(); if (!q) return true; return s.name.includes(q) || (s.hhAccountKey ?? '').includes(q) || (s.taxId ?? '').includes(q); }).slice(0, 200).map((s) => {
                      const e = supEdits[s.id] || {};
                      const missingBank = !e.bankCode || !e.branchCode || !e.bankAccount;
                      const missingHh = !e.hhAccountKey;
                      return (
                        <tr key={s.id}>
                          <td><input value={e.name ?? ''} onChange={(ev) => setSupField(s.id, 'name', ev.target.value)} style={{ width: 150 }} /></td>
                          <td><input value={e.hhAccountKey ?? ''} onChange={(ev) => setSupField(s.id, 'hhAccountKey', ev.target.value)} style={{ width: 90 }} placeholder="400100" />{missingHh && <span title="חסר מפתח חשבשבת" style={{ color: 'var(--warn)', marginInlineStart: 4 }}>⚠</span>}</td>
                          <td><input type="number" value={e.vatRate ?? 18} onChange={(ev) => setSupField(s.id, 'vatRate', ev.target.value)} style={{ width: 55 }} /></td>
                          <td>
                            <select value={e.defaultTerms ?? '30'} onChange={(ev) => setSupField(s.id, 'defaultTerms', ev.target.value)}>
                              {TERMS.map((t) => <option key={t} value={t}>שוטף+{t}</option>)}
                            </select>
                          </td>
                          <td><input value={e.taxId ?? ''} onChange={(ev) => setSupField(s.id, 'taxId', ev.target.value)} style={{ width: 100 }} /></td>
                          <td><input value={e.bankCode ?? ''} onChange={(ev) => setSupField(s.id, 'bankCode', ev.target.value)} style={{ width: 55 }} placeholder="12" /></td>
                          <td><input value={e.branchCode ?? ''} onChange={(ev) => setSupField(s.id, 'branchCode', ev.target.value)} style={{ width: 65 }} placeholder="345" /></td>
                          <td><input value={e.bankAccount ?? ''} onChange={(ev) => setSupField(s.id, 'bankAccount', ev.target.value)} style={{ width: 110 }} placeholder="456789" />{missingBank && <span title="חסרים פרטי בנק" style={{ color: 'var(--warn)', marginInlineStart: 4 }}>⚠</span>}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <button className="btn sm" onClick={() => saveSupplier(s.id)} disabled={supBusy === s.id}>{supBusy === s.id ? '…' : 'שמור'}</button>
                            {canDelete && <button className="btn sm ghost" style={{ color: 'var(--red)', marginInlineStart: 4 }} onClick={() => deleteSupplier(s.id)} disabled={supBusy === s.id} title="מחיקת ספק">מחק</button>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {suppliers.filter((s) => { const q = supSearch.trim(); if (!q) return true; return s.name.includes(q) || (s.hhAccountKey ?? '').includes(q) || (s.taxId ?? '').includes(q); }).length > 200 && (
                <div className="sub2" style={{ marginTop: 8, fontSize: 12 }}>מוצגים 200 ספקים ראשונים — צמצם בחיפוש כדי לראות אחרים.</div>
              )}
              {supMsg && <div className="sub2" style={{ marginTop: 10, color: supMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{supMsg}</div>}
            </div>
            <footer>
              <span className="sub2" style={{ margin: 0, fontSize: 12 }}>מע"מ ברירת מחדל 18%; קבע 0% לספק פטור (אילת).</span>
              <button className="btn" onClick={() => setSupOpen(false)}>סגירה</button>
            </footer>
          </div>
        </div>
      )}

      {hhOpen && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setHhOpen(false)}>
          <div className="modal">
            <header>
              <h3>ייצוא חשבוניות ספק לחשבשבת</h3>
              <button className="x" onClick={() => setHhOpen(false)}>×</button>
            </header>
            <div className="body">
              <p className="sub2" style={{ marginTop: 0, fontSize: 12 }}>
                מופק קובץ אקסל במבנה חשבשבת (ספק · תאריך אסמכתא · אסמכתא · פרויקט · פרטים · חובה · תאריך ערך), שורה לכל שיוך פרויקט, סכום לפני מע"מ. "תאריך ערך" = מועד התשלום לפי תנאי התשלום של הספק.
                נכללות רק חשבוניות מאושרות שטרם יוצאו — כדי שאותה חשבונית לא תיקלט פעמיים.
              </p>
              {hhMsg && <div className={hhMsg.startsWith('✓') ? 'sub2' : 'err'} style={hhMsg.startsWith('✓') ? { color: 'var(--green)', marginBottom: 12 } : { marginBottom: 12 }}>{hhMsg}</div>}
              {!hhPending ? <div className="center-msg">טוען…</div> : (
                <>
                  <div className="cards" style={{ marginBottom: 14 }}>
                    <div className="stat"><div className="k">חשבוניות ממתינות</div><div className="v">{hhPending.invoiceCount}</div></div>
                    <div className="stat"><div className="k">שורות בקובץ</div><div className="v">{hhPending.lineCount}</div></div>
                    <div className="stat"><div className="k">סה"כ חובה (לפני מע"מ)</div><div className="v">{fmt(hhPending.total)} <small>₪</small></div></div>
                  </div>
                  {hhPending.missingKey.length > 0 && (
                    <div className="ro-badge" style={{ display: 'block', marginBottom: 12 }}>⚠ חסר מפתח חשבון חשבשבת לספקים: {hhPending.missingKey.join(', ')} — יש להשלים ב"ניהול ספקים" לפני הייצוא.</div>
                  )}
                  {hhPending.lineCount > 0 && (
                    <div className="panel" style={{ boxShadow: 'none', marginBottom: 12, maxHeight: 240, overflow: 'auto' }}>
                      <table>
                        <thead><tr><th>ספק</th><th>תאריך אסמכתא</th><th>אסמכתא</th><th>פרויקט</th><th>פרטים</th><th>חובה</th><th>תאריך ערך</th></tr></thead>
                        <tbody>
                          {hhPending.rows.map((r, i) => (
                            <tr key={i}><td className="num">{r.supplierKey || '—'}</td><td className="num">{r.date}</td><td className="num">{r.reference}</td><td className="num">{r.project}</td><td>{r.details}</td><td className="num">{fmt(r.debit)}</td><td className="num">{r.valueDate || '—'}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                    <button className="btn" onClick={runHhExport} disabled={hhBusy || hhPending.lineCount === 0 || hhPending.missingKey.length > 0}>
                      {hhBusy ? 'מפיק…' : '⭳ הפק קובץ וסמן כנקלט בחשבשבת'}
                    </button>
                    {hhPending.lineCount === 0 && <span className="sub2" style={{ margin: 0 }}>אין חשבוניות חדשות לייצוא.</span>}
                  </div>

                  {hhHistory.length > 0 && (
                    <>
                      <div className="section-t">אצוות ייצוא קודמות</div>
                      <div className="panel" style={{ boxShadow: 'none' }}>
                        <table>
                          <thead><tr><th>אצווה</th><th>תאריך</th><th>חשבוניות</th><th>סכום</th><th></th></tr></thead>
                          <tbody>
                            {hhHistory.map((b) => (
                              <tr key={b.batch}><td className="num">{b.batch}</td><td className="num">{dmy(b.exportedAt)}</td><td className="num">{b.invoiceCount}</td><td className="num">{fmt(b.total)}</td>
                                <td>{canWrite && <button className="btn ghost sm" style={{ color: 'var(--red)' }} onClick={() => undoHh(b.batch)} disabled={hhBusy}>בטל</button>}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            <footer>
              <span className="sub2" style={{ margin: 0, fontSize: 12 }}>ביטול אצווה מחזיר את חשבוניותיה למצב "ממתין לייצוא".</span>
              <button className="btn ghost" onClick={() => setHhOpen(false)}>סגירה</button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
