import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { BillingDoc, Contract, Project, Offset } from '../types';
import { money, calcVat, calcTotal, shotefPlus, dmy, DOCTYPE_CLASS, DOC_STATUS_CLASS } from '../lib/finance';

const TYPES = ['עסקה', 'מס', 'מס-קבלה'];
const TYPE_LABEL: Record<string, string> = { 'עסקה': 'חשבון עסקה', 'מס': 'חשבונית מס', 'מס-קבלה': 'חשבונית מס-קבלה' };
const STATUSES = ['טיוטה', 'נשלח ללקוח', 'אושר ע"י לקוח', 'טרם שולם', 'שולם חלקית', 'שולם'];
const TERMS = ['0', '30', '45', '60', '90'];

export default function BillingDocs() {
  const { can } = useAuth();
  const canWrite = can('docs', 'write');
  const canDelete = can('docs', 'delete');

  const [docs, setDocs] = useState<BillingDoc[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [q, setQ] = useState('');
  const [fType, setFType] = useState('');
  const [fProject, setFProject] = useState('');

  // טופס
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [type, setType] = useState('מס');
  const [number, setNumber] = useState('');
  const [contractId, setContractId] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [base, setBase] = useState<number | ''>('');
  const [terms, setTerms] = useState('60');
  const [retentionPct, setRetentionPct] = useState<number | ''>(0);
  const [offsets, setOffsets] = useState<Offset[]>([]);
  const [status, setStatus] = useState('טיוטה');
  const [paidAmount, setPaidAmount] = useState<number | ''>(0);
  const [recordedHh, setRecordedHh] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [d, c, p] = await Promise.all([api.billingDocs(), api.contracts(), api.projects()]);
      setDocs(d);
      setContracts(c);
      setProjects(p);
    } catch (e) {
      setErr((e as Error).message || 'שגיאה בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const selectedContract = contracts.find((c) => c.id === contractId);

  const rows = docs.filter((d) => {
    if (q && !(d.customer.includes(q) || d.number.includes(q))) return false;
    if (fType && d.type !== fType) return false;
    if (fProject && d.projectId !== fProject) return false;
    return true;
  });

  const isTax = type !== 'עסקה';
  const baseNum = Number(base) || 0;
  const vat = calcVat(baseNum);
  const gross = calcTotal(baseNum);
  const retention = isTax ? Math.round((baseNum * (Number(retentionPct) || 0)) / 100) : 0;
  const offSum = offsets.reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const net = gross - retention - offSum;
  const dueDate = shotefPlus(issueDate, parseInt(terms, 10));

  const projLabel = useMemo(() => {
    const m: Record<string, string> = {};
    projects.forEach((p) => (m[p.id] = p.code));
    return m;
  }, [projects]);

  function openForm(d?: BillingDoc) {
    if (!canWrite) return;
    setFormErr('');
    if (d) {
      setEditId(d.id);
      setType(d.type);
      setNumber(d.number);
      setContractId(d.contractId);
      setIssueDate(d.issueDate);
      setBase(d.amountBeforeVat);
      setTerms(d.terms);
      setRetentionPct(d.retentionPct);
      setOffsets(d.offsets.map((o) => ({ ...o })));
      setStatus(d.status);
      setPaidAmount(d.paidAmount);
      setRecordedHh(d.recordedHh);
    } else {
      setEditId(null);
      setType('מס');
      setNumber('');
      const c0 = contracts[0];
      setContractId(c0?.id ?? '');
      setIssueDate(new Date().toISOString().slice(0, 10));
      setBase('');
      setTerms(c0?.paymentTerms ?? '60');
      setRetentionPct(c0?.retentionPct ?? 0);
      setOffsets([]);
      setStatus('טיוטה');
      setPaidAmount(0);
      setRecordedHh(false);
    }
    setOpen(true);
  }

  function onContractChange(id: string) {
    setContractId(id);
    const c = contracts.find((x) => x.id === id);
    if (c) {
      setTerms(c.paymentTerms);
      setRetentionPct(c.retentionPct);
    }
  }

  async function save() {
    if (!contractId || !baseNum) {
      setFormErr('נא לבחור חוזה ולמלא סכום');
      return;
    }
    setSaving(true);
    setFormErr('');
    try {
      const payload = {
        type,
        number: number || 'חדש',
        contractId,
        issueDate,
        amountBeforeVat: baseNum,
        retentionPct: Number(retentionPct) || 0,
        terms,
        status,
        paidAmount: Number(paidAmount) || 0,
        recordedHh,
        offsets: offsets.filter((o) => o.reason && o.amount).map((o) => ({ reason: o.reason, amount: Number(o.amount) })),
      };
      if (editId) await api.updateBillingDoc(editId, payload);
      else await api.createBillingDoc(payload);
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
    if (!confirm('למחוק את המסמך?')) return;
    setSaving(true);
    try {
      await api.deleteBillingDoc(editId);
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
          <h2 className="title">חשבוניות ללקוח</h2>
          <p className="sub2">חשבונות עסקה וחשבוניות מס — כולל עכבונות וקיזוזים, מוכן לקליטה בחשבשבת</p>
        </div>
        {canWrite && <button className="btn" onClick={() => openForm()}>＋ מסמך חיוב חדש</button>}
      </div>

      {!canWrite && <div className="ro-badge">🔒 צפייה בלבד — אין לך הרשאת עריכה במודול זה</div>}

      <div className="toolbar">
        <div className="grow"><input placeholder="חיפוש לקוח / מספר מסמך…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select value={fType} onChange={(e) => setFType(e.target.value)}>
          <option value="">כל הסוגים</option>
          {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
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
              <th>סוג / מספר</th><th>לקוח</th><th>פרויקט</th><th>תאריך</th><th>כולל מע"מ</th>
              <th>עכבון</th><th>קיזוזים</th><th>נטו לתשלום</th><th>לתשלום עד</th><th>סטטוס</th><th>חשבשבת</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40 }} className="muted">לא נמצאו מסמכים</td></tr>
            )}
            {rows.map((d) => (
              <tr key={d.id} className={canWrite ? 'click' : ''} onClick={() => openForm(d)}>
                <td>
                  <span className={`doctype ${DOCTYPE_CLASS[d.type]}`}>{TYPE_LABEL[d.type]}</span>
                  <div className="num" style={{ marginTop: 3 }}>{d.number}</div>
                </td>
                <td>{d.customer}</td>
                <td><span className="chip">{d.project?.code ?? projLabel[d.projectId ?? ''] ?? '—'}</span></td>
                <td className="num">{dmy(d.issueDate)}</td>
                <td className="num">{money(d.gross)}</td>
                <td className="num">{d.retention ? money(d.retention) : '—'}</td>
                <td className={`num ${d.offsetsSum ? 'neg' : ''}`}>{d.offsetsSum ? '−' + money(d.offsetsSum) : '—'}</td>
                <td className="num strong">{money(d.net)}</td>
                <td className="num">{d.type === 'עסקה' ? <span className="muted">—</span> : dmy(d.dueDate)}</td>
                <td><span className={`badge ${DOC_STATUS_CLASS[d.status] || 'b-gray'}`}>{d.status}</span></td>
                <td>{d.type === 'עסקה' ? <span className="hh-flag">לא רלוונטי</span> : <span className={`hh-flag ${d.recordedHh ? 'on' : ''}`}>{d.recordedHh ? 'נקלט' : 'ממתין'}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal">
            <header>
              <h3>{editId ? 'עריכת מסמך חיוב' : 'מסמך חיוב חדש'}</h3>
              <button className="x" onClick={() => setOpen(false)}>×</button>
            </header>
            <div className="body">
              {formErr && <div className="err">{formErr}</div>}
              <div className="section-t">פרטי המסמך</div>
              <div className="grid3">
                <label className="fld"><span>סוג מסמך</span>
                  <select value={type} onChange={(e) => setType(e.target.value)} style={{ width: '100%' }}>
                    {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                  </select>
                </label>
                <label className="fld"><span>מספר מסמך</span><input value={number} onChange={(e) => setNumber(e.target.value)} /></label>
                <label className="fld"><span>חוזה</span>
                  <select value={contractId} onChange={(e) => onContractChange(e.target.value)} style={{ width: '100%' }}>
                    <option value="">בחר חוזה…</option>
                    {contracts.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.customer}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid3" style={{ marginTop: 14 }}>
                <label className="fld"><span>לקוח <span className="auto-badge">מהחוזה</span></span><input value={selectedContract?.customer ?? ''} readOnly /></label>
                <label className="fld"><span>פרויקט <span className="auto-badge">מהחוזה</span></span><input value={selectedContract?.project ? `${selectedContract.project.code} · ${selectedContract.project.name}` : ''} readOnly /></label>
                <label className="fld"><span>תאריך הפקה</span><input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></label>
              </div>
              <div className="grid3" style={{ marginTop: 14 }}>
                <label className="fld"><span>סכום (לפני מע"מ)</span><input type="number" value={base} onChange={(e) => setBase(e.target.value === '' ? '' : Number(e.target.value))} /></label>
                <label className="fld"><span>תנאי תשלום <span className="auto-badge">מהחוזה</span></span>
                  <select value={terms} onChange={(e) => setTerms(e.target.value)} style={{ width: '100%' }}>
                    {TERMS.map((t) => <option key={t} value={t}>שוטף+{t}</option>)}
                  </select>
                </label>
                <label className="fld"><span>לתשלום עד <span className="auto-badge">מחושב</span></span><input value={type === 'עסקה' ? '—' : dmy(dueDate)} readOnly /></label>
              </div>

              <div className="section-t">עכבון וקיזוזים</div>
              <div className="grid2">
                <label className="fld"><span>עכבון % <span className="auto-badge">מהחוזה</span></span><input type="number" value={retentionPct} onChange={(e) => setRetentionPct(e.target.value === '' ? '' : Number(e.target.value))} disabled={!isTax} /></label>
                <div />
              </div>
              <div className="sub2" style={{ margin: '10px 0 4px', fontSize: 12 }}>קיזוזים (ניכוי חומרים, פיצוי איחור, ניכוי מס במקור…):</div>
              <table className="lines-tbl">
                <thead><tr><th style={{ width: '65%' }}>סיבת הקיזוז</th><th style={{ width: '28%' }}>סכום</th><th /></tr></thead>
                <tbody>
                  {offsets.map((o, i) => (
                    <tr key={i}>
                      <td><input value={o.reason} placeholder="סיבת הקיזוז" onChange={(e) => setOffsets((os) => os.map((x, xi) => xi === i ? { ...x, reason: e.target.value } : x))} /></td>
                      <td><input type="number" value={o.amount || ''} onChange={(e) => setOffsets((os) => os.map((x, xi) => xi === i ? { ...x, amount: Number(e.target.value) || 0 } : x))} /></td>
                      <td><button className="icon-btn" onClick={() => setOffsets((os) => os.filter((_, xi) => xi !== i))}>🗑</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => setOffsets((os) => [...os, { reason: '', amount: 0 }])}>＋ קיזוז</button>

              <div className="calc-box">
                <div className="calc-row"><span className="lbl">לפני מע"מ</span><span>{money(baseNum)}</span></div>
                <div className="calc-row"><span className="lbl">מע"מ 18%</span><span>{money(vat)}</span></div>
                <div className="calc-row"><span className="lbl">סה"כ כולל מע"מ</span><span>{money(gross)}</span></div>
                <div className="calc-row"><span className="lbl">עכבון ({isTax ? Number(retentionPct) || 0 : 0}%)</span><span className="neg">−{money(retention)}</span></div>
                {offSum > 0 && <div className="calc-row"><span className="lbl">קיזוזים</span><span className="neg">−{money(offSum)}</span></div>}
                <div className="calc-row total"><span>נטו לתשלום</span><span>{money(net)}</span></div>
              </div>

              <div className="section-t">סטטוס</div>
              <div className="grid3">
                <label className="fld"><span>סטטוס</span>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: '100%' }}>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
                <label className="fld"><span>נגבה (₪)</span><input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value === '' ? '' : Number(e.target.value))} /></label>
                <label className="fld"><span>נקלט בחשבשבת</span>
                  <select value={recordedHh ? 'yes' : 'no'} onChange={(e) => setRecordedHh(e.target.value === 'yes')} style={{ width: '100%' }} disabled={!isTax}>
                    <option value="no">לא</option><option value="yes">כן</option>
                  </select>
                </label>
              </div>
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
    </>
  );
}
