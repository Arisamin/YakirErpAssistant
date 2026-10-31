import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { Project, CashflowData, OpenPayment } from '../types';
import {
  buildProject, buildSummary, buildAging, buildCashflow, fmtCell, getLogoDataUrl,
  exportExcel, exportWord, exportPDF, sendOutlook, downloadText, exportMasavExcel,
  type ReportModel, type ExportCtx, type MasavResp,
} from '../lib/reports';
import { money, dmy } from '../lib/finance';

const TYPES = [
  { k: 'project', t: 'דוח חיתוך פרויקט' },
  { k: 'summary', t: 'סיכום כל הפרויקטים' },
  { k: 'aging', t: 'דוח גיול חובות' },
  { k: 'cashflow', t: 'דוח תזרים מזומנים' },
];
const today = new Date().toISOString().slice(0, 10);

export default function Reports() {
  const { me } = useAuth();
  const [type, setType] = useState('project');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [model, setModel] = useState<ReportModel | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [logo, setLogo] = useState('');

  // מקבץ תשלומים (מס"ב)
  const [masavFrom, setMasavFrom] = useState(today);
  const [masavTo, setMasavTo] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 45); return d.toISOString().slice(0, 10); });
  const [masav, setMasav] = useState<MasavResp | null>(null);
  const [masavErr, setMasavErr] = useState('');
  const [masavBusy, setMasavBusy] = useState(false);
  const [showSpec, setShowSpec] = useState(false);

  // תזרים כרונולוגי + המרות + מקבץ תשלומים
  const [cf, setCf] = useState<CashflowData | null>(null);
  const [convBusy, setConvBusy] = useState('');
  const [batchOpen, setBatchOpen] = useState(false);
  const [openPays, setOpenPays] = useState<OpenPayment[]>([]);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [batchDate, setBatchDate] = useState(today);
  const [batchRef, setBatchRef] = useState('');
  const [pasteRefs, setPasteRefs] = useState('');
  const [pdfName, setPdfName] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchMsg, setBatchMsg] = useState('');

  async function loadCashflow() {
    const raw = await api.reportCashflow();
    setCf(raw as CashflowData);
    setModel(buildCashflow(raw));
  }
  async function convertRow(kind: string, id: string) {
    setConvBusy(id);
    try {
      if (kind === 'supplier-esek') await api.convertSupplierInvoice(id);
      else await api.convertBillingDoc(id);
      await loadCashflow();
    } catch (e) { setErr((e as Error).message || 'שגיאה בהמרה'); }
    finally { setConvBusy(''); }
  }
  async function openBatch() {
    setBatchMsg(''); setBatchOpen(true); setSel({}); setPasteRefs(''); setBatchRef(''); setPdfName(''); setPdfUrl('');
    try { setOpenPays(await api.openPayments()); } catch (e) { setBatchMsg((e as Error).message || 'שגיאה'); }
  }
  function onPdfPick(f: File | undefined) {
    if (!f) return;
    setPdfName(f.name);
    try { setPdfUrl(URL.createObjectURL(f)); } catch { /* ignore */ }
    if (!batchRef) setBatchRef(f.name.replace(/\.pdf$/i, ''));
  }
  function applyPaste() {
    const tokens = pasteRefs.split(/[\s,;\n]+/).map((s) => s.trim()).filter(Boolean);
    if (!tokens.length) return;
    const next: Record<string, boolean> = { ...sel };
    let hit = 0;
    for (const p of openPays) {
      if (tokens.some((t) => p.invoiceNo === t || (p.selfInvoiceNo && p.selfInvoiceNo === t))) { next[p.id] = true; hit++; }
    }
    setSel(next);
    setBatchMsg(hit ? `✓ זוהו והותאמו ${hit} חשבוניות לפי האסמכתאות שהודבקו` : 'לא נמצאה התאמה לאסמכתאות שהודבקו');
  }
  async function confirmBatch() {
    const ids = openPays.filter((p) => sel[p.id]).map((p) => p.id);
    if (!ids.length) { setBatchMsg('לא נבחרו חשבוניות'); return; }
    setBatchBusy(true); setBatchMsg('');
    try {
      const r = await api.markPaid({ ids, payDate: batchDate, batchRef: batchRef || undefined });
      setBatchMsg(`✓ סומנו ${r.marked} חשבוניות כשולמו (${dmy(batchDate)}). התזרים עודכן.`);
      setOpenPays(await api.openPayments()); setSel({});
      await loadCashflow();
    } catch (e) { setBatchMsg((e as Error).message || 'שגיאה בסימון'); }
    finally { setBatchBusy(false); }
  }
  const selCount = openPays.filter((p) => sel[p.id]).length;
  const selTotal = openPays.filter((p) => sel[p.id]).reduce((s, p) => s + p.total, 0);
  const proformas = (cf?.ledger || []).filter((r) => r.kind === 'supplier-esek' || r.kind === 'customer-esek');

  useEffect(() => {
    api.projects().then((p) => {
      setProjects(p);
      if (p[0]) setProjectId(p[0].id);
    });
    getLogoDataUrl().then(setLogo);
  }, []);

  useEffect(() => {
    if (type === 'project' && !projectId) return;
    setLoading(true);
    setErr('');
    (async () => {
      try {
        if (type === 'cashflow') {
          await loadCashflow();
        } else {
          let m: ReportModel;
          if (type === 'project') m = buildProject(await api.reportProject(projectId));
          else if (type === 'summary') m = buildSummary(await api.reportSummary());
          else m = buildAging(await api.reportAging());
          setModel(m);
        }
      } catch (e) {
        setErr((e as Error).message || 'שגיאה בהפקת הדוח');
        setModel(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [type, projectId]);

  const ctx: ExportCtx = useMemo(() => ({ producedBy: me?.name ?? '—', today: dmy(today), logo }), [me, logo]);

  async function genMasav() {
    setMasavErr('');
    setMasavBusy(true);
    setMasav(null);
    try {
      const r: MasavResp = await api.masav(masavFrom, masavTo);
      setMasav(r);
      if (r.count === 0) setMasavErr('לא נמצאו חשבוניות מאושרות לתשלום בטווח שנבחר');
    } catch (e) {
      setMasavErr((e as Error).message || 'שגיאה בהפקת קובץ מס"ב');
    } finally {
      setMasavBusy(false);
    }
  }

  return (
    <>
      <div className="row-between no-print">
        <div>
          <h2 className="title">דוחות חיתוך לפי פרויקט</h2>
          <p className="sub2">פירוט הכנסות, הוצאות (חומרים ועבודה), גיול ותזרים — מנתוני המערכת</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label className="fld" style={{ margin: 0, minWidth: 180 }}><span>סוג דוח</span>
            <select value={type} onChange={(e) => setType(e.target.value)} style={{ width: '100%' }}>
              {TYPES.map((t) => <option key={t.k} value={t.k}>{t.t}</option>)}
            </select>
          </label>
          {type === 'project' && (
            <label className="fld" style={{ margin: 0, minWidth: 180 }}><span>בחר פרויקט</span>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ width: '100%' }}>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
              </select>
            </label>
          )}
          <button className="btn" style={{ background: 'var(--green)' }} disabled={!model} onClick={() => model && exportExcel(model, ctx)}>⭳ Excel</button>
          <button className="btn ghost" disabled={!model} onClick={() => model && exportWord(model, ctx)}>⭳ Word</button>
          <button className="btn ghost" disabled={!model} onClick={() => model && exportPDF(model, ctx)}>⭳ PDF</button>
          <button className="btn" disabled={!model} onClick={() => model && sendOutlook(model, ctx)}>✉ שליחה באאוטלוק</button>
        </div>
      </div>

      {type === 'cashflow' && (
        <div className="panel pad no-print" style={{ margin: '4px 0 18px' }}>
          <div className="row-between" style={{ alignItems: 'center' }}>
            <div>
              <div className="strong" style={{ fontSize: 15 }}>מקבץ תשלומים לספקים — קובץ מס"ב</div>
              <div className="sub2" style={{ margin: '2px 0 0', fontSize: 12 }}>בחר טווח מועדי תשלום (15/30); המערכת תפיק קובץ מס"ב לכל החשבוניות המאושרות לתשלום שטרם שולמו בטווח.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <label className="fld" style={{ margin: 0 }}><span>מתאריך</span><input type="date" value={masavFrom} onChange={(e) => setMasavFrom(e.target.value)} /></label>
              <label className="fld" style={{ margin: 0 }}><span>עד תאריך</span><input type="date" value={masavTo} onChange={(e) => setMasavTo(e.target.value)} /></label>
              <button className="btn" onClick={genMasav} disabled={masavBusy}>{masavBusy ? 'מפיק…' : 'הפקת קובץ מס"ב'}</button>
            </div>
          </div>
          {masavErr && <div className="err" style={{ marginTop: 12, marginBottom: 0 }}>{masavErr}</div>}
          {masav && masav.count > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 10 }}>
                <div><span className="muted" style={{ fontSize: 12 }}>מספר תשלומים: </span><b>{masav.count}</b></div>
                <div><span className="muted" style={{ fontSize: 12 }}>סכום כולל: </span><b>{money(masav.total)}</b></div>
                <div><span className="muted" style={{ fontSize: 12 }}>מוסד שולח: </span><b>{masav.institutionCode}</b>{masav.senderName ? <span className="muted"> · {masav.senderName}</span> : null}</div>
              </div>
              {masav.placeholder && (
                <div className="ro-badge" style={{ display: 'block', marginBottom: 10 }}>⚠ קוד "מוסד שולח" הוא ערך דוגמה (00000000). יש להזין את הקוד האמיתי מהבנק לפני שימוש בייצור, ולאמת את מבנה הקובץ מול מפרט המס"ב של הבנק.</div>
              )}
              {masav.warnings.length > 0 && (
                <div className="ro-badge" style={{ display: 'block', marginBottom: 10 }}>⚠ ספקים ללא פרטי בנק מלאים: {masav.warnings.join(', ')} — יש להשלים פרטי בנק/סניף/חשבון.</div>
              )}
              <div className="panel" style={{ marginBottom: 12 }}>
                <table>
                  <thead><tr><th>מועד תשלום</th><th>ספק</th><th>מס' חשבונית</th><th>בנק-סניף-חשבון</th><th>סכום</th></tr></thead>
                  <tbody>
                    {masav.preview.map((p, i) => (
                      <tr key={i}><td>{dmy(p.runDate)}</td><td className="strong">{p.supplier}</td><td className="num">{p.invoiceNo}</td><td className="num">{p.bank}</td><td className="num">{money(p.amount)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => downloadText(masav.filename, masav.content)}>⭳ הורדת קובץ מס"ב (.txt)</button>
                <button className="btn ghost" style={{ color: 'var(--green)' }} onClick={() => exportMasavExcel(masav, masavFrom, masavTo, ctx)}>⭳ פירוט לאקסל</button>
                {masav.spec && <button className="btn ghost" onClick={() => setShowSpec((v) => !v)}>{showSpec ? 'הסתר מבנה רשומות' : '📄 מבנה רשומות הקובץ'}</button>}
              </div>

              {showSpec && masav.spec && (
                <div style={{ marginTop: 14 }}>
                  <div className="sub2" style={{ fontSize: 12, marginBottom: 8 }}>אורך רשומה קבוע: {masav.spec.lineLength} תווים. מבנה זה הוא קירוב מתועד — יש לאמת מול מפרט המס"ב של הבנק לפני ייצור.</div>
                  {masav.spec.records.map((rec) => (
                    <div key={rec.type} style={{ marginBottom: 12 }}>
                      <div className="strong" style={{ fontSize: 13, marginBottom: 4 }}>רשומה סוג {rec.type} — {rec.name}</div>
                      <div className="panel" style={{ boxShadow: 'none' }}>
                        <table>
                          <thead><tr><th>מיקום</th><th>אורך</th><th>שדה</th><th>דוגמה</th></tr></thead>
                          <tbody>
                            {rec.fields.map((f, i) => (
                              <tr key={i}><td className="num">{f.pos}</td><td className="num">{f.len}</td><td>{f.name}</td><td className="num" style={{ direction: 'ltr', textAlign: 'right' }}>{f.sample}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {type === 'cashflow' && (
        <div className="panel pad no-print" style={{ margin: '4px 0 18px' }}>
          <div className="row-between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div className="strong" style={{ fontSize: 15 }}>עדכון תשלומים ממקבץ (קובץ PDF)</div>
              <div className="sub2" style={{ margin: '2px 0 0', fontSize: 12 }}>העלה את דוח ההעברות במקבץ מהבנק, סמן את החשבוניות ששולמו (ידנית או ע"י הדבקת מספרי החשבוניות מהדוח), והתזרים יעודכן אוטומטית.</div>
            </div>
            <button className="btn" onClick={openBatch}>⬆ עדכון תשלומים ממקבץ</button>
          </div>

          {proformas.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="strong" style={{ fontSize: 14, marginBottom: 4 }}>חשבונות עסקה (פרופורמה) בתזרים — ניתנים להמרה לחשבונית</div>
              <div className="sub2" style={{ fontSize: 12, marginBottom: 8 }}>חשבון עסקה מוצג בתזרים כתנועה צפויה. לאחר הפקת חשבונית מס בפועל — המר אותו לחשבונית והתזרים יתעדכן.</div>
              <div className="panel" style={{ boxShadow: 'none' }}>
                <table>
                  <thead><tr><th>סוג</th><th>לקוח/ספק</th><th>אסמכתא</th><th>פרויקט</th><th>סכום</th><th></th></tr></thead>
                  <tbody>
                    {proformas.map((r) => (
                      <tr key={r.kind + r.id}>
                        <td>{r.kind === 'supplier-esek' ? 'חשבון עסקה — ספק' : 'חשבון עסקה — לקוח'}</td>
                        <td className="strong">{r.name}</td>
                        <td className="num">{r.reference}</td>
                        <td>{r.project}</td>
                        <td className="num">{money(r.expense || r.income)}</td>
                        <td>
                          <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12 }} disabled={convBusy === r.id} onClick={() => convertRow(r.kind, r.id)}>
                            {convBusy === r.id ? 'ממיר…' : (r.kind === 'supplier-esek' ? 'המר לחשבונית ספק' : 'המר לחשבונית לקוח')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {batchOpen && (
        <div className="overlay no-print" onMouseDown={(e) => e.target === e.currentTarget && !batchBusy && setBatchOpen(false)}>
          <div className="modal">
            <header>
              <h3>עדכון תשלומים ממקבץ</h3>
              <button className="x" onClick={() => setBatchOpen(false)} disabled={batchBusy}>×</button>
            </header>
            <div className="body">
              <p className="sub2" style={{ marginTop: 0, fontSize: 12 }}>
                העלה את דוח ההעברות במקבץ מהבנק (PDF), הזן את מועד ההעברה בפועל, וסמן את החשבוניות ששולמו. ניתן להדביק את מספרי החשבוניות מדוח ההעברות לסימון אוטומטי. עם האישור — החשבוניות יסומנו כשולמו והתזרים יעודכן.
              </p>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
                <label className="fld" style={{ margin: 0 }}><span>קובץ ההעברות (PDF)</span>
                  <input type="file" accept="application/pdf,.pdf" onChange={(e) => onPdfPick(e.target.files?.[0])} />
                </label>
                {pdfName && <a className="sub2" href={pdfUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>📄 {pdfName} (פתח לצפייה)</a>}
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
                <label className="fld" style={{ margin: 0 }}><span>מועד ההעברה בפועל</span><input type="date" value={batchDate} onChange={(e) => setBatchDate(e.target.value)} /></label>
                <label className="fld" style={{ margin: 0, flex: 1, minWidth: 180 }}><span>אסמכתת מקבץ</span><input type="text" value={batchRef} onChange={(e) => setBatchRef(e.target.value)} placeholder="מס' מקבץ / שם הקובץ" /></label>
              </div>

              <div className="panel pad" style={{ boxShadow: 'none', marginBottom: 12 }}>
                <div className="sub2" style={{ fontSize: 12, marginBottom: 6 }}>סימון מהיר: הדבק את מספרי החשבוניות/חשבונות העסקה מדוח ההעברות (מופרדים ברווח, פסיק או שורה) והמערכת תסמן אוטומטית את המתאימות.</div>
                <textarea value={pasteRefs} onChange={(e) => setPasteRefs(e.target.value)} rows={3} style={{ width: '100%', boxSizing: 'border-box' }} placeholder="לדוגמה: 10453 10460 10471" />
                <button className="btn ghost" style={{ marginTop: 8 }} onClick={applyPaste}>🔎 התאם וסמן לפי האסמכתאות</button>
              </div>

              <div className="panel" style={{ boxShadow: 'none', maxHeight: '38vh', overflow: 'auto' }}>
                <table>
                  <thead><tr>
                    <th style={{ width: 34 }}></th><th>ספק</th><th>מס' חשבונית</th><th>מועד תשלום</th><th>סכום</th>
                  </tr></thead>
                  <tbody>
                    {openPays.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 18 }}>אין חשבוניות פתוחות לתשלום</td></tr>}
                    {openPays.map((p) => (
                      <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setSel((s) => ({ ...s, [p.id]: !s[p.id] }))}>
                        <td style={{ textAlign: 'center' }}><input type="checkbox" checked={!!sel[p.id]} readOnly /></td>
                        <td className="strong">{p.supplier}</td>
                        <td className="num">{p.invoiceNo}{p.selfInvoiceNo ? <span className="muted"> · {p.selfInvoiceNo}</span> : null}</td>
                        <td>{p.payDate ? dmy(p.payDate) : '—'}</td>
                        <td className="num">{money(p.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {batchMsg && <div className="sub2" style={{ marginTop: 10, color: batchMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{batchMsg}</div>}
            </div>
            <footer>
              <span className="sub2" style={{ margin: 0, fontSize: 13 }}>נבחרו <b>{selCount}</b> חשבוניות · סה"כ <b>{money(selTotal)}</b></span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn ghost" onClick={() => setBatchOpen(false)} disabled={batchBusy}>ביטול</button>
                <button className="btn" onClick={confirmBatch} disabled={batchBusy || selCount === 0}>{batchBusy ? 'מעדכן…' : `✓ סמן ${selCount} כשולמו`}</button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {err && <div className="center-msg">{err}</div>}
      {loading && <div className="center-msg">מפיק דוח…</div>}
      {model && !loading && (
        <div id="report-area">
          <div className="rep-head">
            <div>
              <div style={{ fontSize: 19, fontWeight: 800 }}>{model.title}</div>
              {model.subtitle && <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{model.subtitle}</div>}
              <div className="sub2" style={{ margin: '4px 0 0' }}>תאריך הפקה: {dmy(today)} &nbsp;·&nbsp; הופק ע"י: {me?.name}</div>
            </div>
            {logo && <img src={logo} alt="אתניב" style={{ height: 46, width: 'auto' }} />}
          </div>

          {model.kpis.length > 0 && (
            <div className="rep-kpis">
              {model.kpis.map((k, i) => (
                <div className="rep-kpi" key={i}><div className="k">{k.label}</div><div className={`v ${k.cls ?? ''}`}>{k.value}</div></div>
              ))}
            </div>
          )}

          {model.tables.map((tb, ti) => (
            <div key={ti}>
              <div className="rep-sec-title">{tb.heading}</div>
              <div className="panel">
                <table>
                  <thead><tr>{tb.columns.map((c, ci) => <th key={ci}>{c.h}</th>)}</tr></thead>
                  <tbody>
                    {tb.rows.length === 0 && <tr><td colSpan={tb.columns.length} className="muted" style={{ textAlign: 'center', padding: 22 }}>אין נתונים</td></tr>}
                    {tb.rows.map((r, ri) => (
                      <tr key={ri}>{r.map((v, ci) => <td key={ci} className={tb.columns[ci].t === 'num' ? 'num' : ''}>{fmtCell(tb.columns[ci], v)}</td>)}</tr>
                    ))}
                  </tbody>
                  {tb.footer && (
                    <tfoot><tr>{tb.footer.map((v, ci) => <td key={ci} className={tb.columns[ci].t === 'num' ? 'num' : ''}>{v === '' ? '' : fmtCell(tb.columns[ci], v)}</td>)}</tr></tfoot>
                  )}
                </table>
              </div>
            </div>
          ))}
          <p className="sub2" style={{ marginTop: 12, fontSize: 12 }}>
            דוח נכון לתאריך {dmy(today)}. © 2026 אתניב ב.י בע"מ — קניין רוחני בלעדי, סודי ומיועד למורשים בלבד.
          </p>
        </div>
      )}
    </>
  );
}
