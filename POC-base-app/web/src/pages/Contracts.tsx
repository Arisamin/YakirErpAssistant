import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { Contract, Customer, Project } from '../types';
import { money, fmt, VAT_RATE } from '../lib/finance';

const TERMS = ['0', '30', '45', '60', '90'];

export default function Contracts() {
  const { can } = useAuth();
  const canWrite = can('contracts', 'write');
  const canDelete = can('contracts', 'delete');

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // טופס
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [value, setValue] = useState<number | ''>('');
  const [paymentTerms, setPaymentTerms] = useState('60');
  const [retentionPct, setRetentionPct] = useState<number | ''>(5);
  const [status, setStatus] = useState('פעיל');
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  // ניהול לקוחות
  const [custOpen, setCustOpen] = useState(false);
  const [custEdits, setCustEdits] = useState<Record<string, Partial<Customer>>>({});
  const [custBusy, setCustBusy] = useState('');
  const [custMsg, setCustMsg] = useState('');
  const [custSearch, setCustSearch] = useState('');
  const [ncName, setNcName] = useState('');
  const [ncTax, setNcTax] = useState('');

  function openCustomers() {
    const init: Record<string, Partial<Customer>> = {};
    customers.forEach((c) => { init[c.id] = { name: c.name, taxId: c.taxId ?? '' }; });
    setCustEdits(init); setCustMsg(''); setCustSearch(''); setNcName(''); setNcTax(''); setCustOpen(true);
  }
  function setCustField(id: string, k: keyof Customer, v: string) {
    setCustEdits((e) => ({ ...e, [id]: { ...e[id], [k]: v } }));
  }
  async function saveCustomer(id: string) {
    setCustBusy(id); setCustMsg('');
    try {
      const e = custEdits[id] || {};
      const up = await api.updateCustomer(id, { name: e.name, taxId: e.taxId });
      setCustomers((cs) => cs.map((c) => (c.id === id ? up : c)));
      setCustMsg('✓ נשמר: ' + (e.name || ''));
    } catch (err) { setCustMsg((err as Error).message || 'שגיאה בשמירה'); }
    finally { setCustBusy(''); }
  }
  async function deleteCustomer(id: string) {
    const c = customers.find((x) => x.id === id);
    if (!confirm(`למחוק את הלקוח "${c?.name || ''}"? פעולה זו בלתי הפיכה. (ניתן למחוק רק לקוח ללא חוזים מקושרים.)`)) return;
    setCustBusy(id); setCustMsg('');
    try {
      await api.deleteCustomer(id);
      setCustomers((cs) => cs.filter((x) => x.id !== id));
      setCustMsg('✓ הלקוח נמחק: ' + (c?.name || ''));
    } catch (err) { setCustMsg((err as Error).message || 'שגיאה במחיקה'); }
    finally { setCustBusy(''); }
  }
  async function addCustomer() {
    if (!ncName.trim()) { setCustMsg('נא למלא שם לקוח'); return; }
    setCustBusy('new'); setCustMsg('');
    try {
      const c = await api.createCustomer({ name: ncName.trim(), taxId: ncTax.trim() || undefined });
      setCustomers((cs) => [...cs, c].sort((a, b) => a.name.localeCompare(b.name, 'he')));
      setCustEdits((e) => ({ ...e, [c.id]: { name: c.name, taxId: c.taxId ?? '' } }));
      setNcName(''); setNcTax('');
      setCustMsg('✓ לקוח נוסף: ' + c.name);
    } catch (err) { setCustMsg((err as Error).message || 'שגיאה בהוספה'); }
    finally { setCustBusy(''); }
  }

  async function load() {
    setLoading(true);
    try {
      const [c, cu, p] = await Promise.all([api.contracts(), api.customers(), api.projects()]);
      setContracts(c);
      setCustomers(cu);
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

  const projLabel = (id: string) => {
    const p = projects.find((x) => x.id === id);
    return p ? `${p.code} · ${p.name}` : '—';
  };

  const stats = useMemo(() => {
    const active = contracts.filter((c) => c.status === 'פעיל').length;
    const totalValue = contracts.reduce((s, c) => s + c.value * (1 + VAT_RATE), 0);
    const billed = contracts.reduce((s, c) => s + c.billed, 0);
    const retention = contracts.reduce((s, c) => s + c.retentionHeld, 0);
    const open = contracts.reduce((s, c) => s + c.open, 0);
    return { active, totalValue, billed, retention, open };
  }, [contracts]);

  function openForm(c?: Contract) {
    if (!canWrite) return;
    setFormErr('');
    if (c) {
      setEditId(c.id);
      setCode(c.code);
      setCustomerName(c.customer);
      setProjectId(c.projectId);
      setValue(c.value);
      setPaymentTerms(c.paymentTerms);
      setRetentionPct(c.retentionPct);
      setStatus(c.status);
    } else {
      setEditId(null);
      setCode('');
      setCustomerName('');
      setProjectId(projects[0]?.id ?? '');
      setValue('');
      setPaymentTerms('60');
      setRetentionPct(5);
      setStatus('פעיל');
    }
    setOpen(true);
  }

  async function save() {
    if (!code || !customerName || !projectId) {
      setFormErr('נא למלא מספר חוזה, לקוח ופרויקט');
      return;
    }
    setSaving(true);
    setFormErr('');
    try {
      const payload = {
        code,
        customerName,
        projectId,
        value: Number(value) || 0,
        paymentTerms,
        retentionPct: Number(retentionPct) || 0,
        status,
      };
      if (editId) await api.updateContract(editId, payload);
      else await api.createContract(payload);
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
    if (!confirm('למחוק את החוזה?')) return;
    setSaving(true);
    try {
      await api.deleteContract(editId);
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
          <h2 className="title">חוזים ולקוחות</h2>
          <p className="sub2">חוזים משויכים לפרויקטים — ערך, תנאי תשלום, עכבון ומצב גבייה</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canWrite && <button className="btn ghost" onClick={openCustomers}>👥 ניהול לקוחות</button>}
          {canWrite && <button className="btn" onClick={() => openForm()}>＋ חוזה חדש</button>}
        </div>
      </div>

      {!canWrite && <div className="ro-badge">🔒 צפייה בלבד — אין לך הרשאת עריכה במודול זה</div>}

      <div className="cards">
        <div className="stat"><div className="k">חוזים פעילים</div><div className="v">{stats.active}</div></div>
        <div className="stat"><div className="k">היקף חוזים (כולל מע"מ)</div><div className="v">{fmt(stats.totalValue)} <small>₪</small></div></div>
        <div className="stat"><div className="k">חויב</div><div className="v">{fmt(stats.billed)} <small>₪</small></div></div>
        <div className="stat"><div className="k">עכבון מוחזק</div><div className="v" style={{ color: '#6d5bd0' }}>{fmt(stats.retention)} <small>₪</small></div></div>
        <div className="stat"><div className="k">יתרה פתוחה לגבייה</div><div className="v" style={{ color: 'var(--red)' }}>{fmt(stats.open)} <small>₪</small></div></div>
      </div>

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>חוזה</th><th>לקוח</th><th>פרויקט</th><th>ערך חוזה</th><th>תנאי תשלום</th>
              <th>עכבון</th><th>חויב</th><th>נגבה</th><th>יתרה פתוחה</th><th>סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {contracts.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40 }} className="muted">אין חוזים עדיין</td></tr>
            )}
            {contracts.map((c) => (
              <tr key={c.id} className={canWrite ? 'click' : ''} onClick={() => openForm(c)}>
                <td className="strong">{c.code}</td>
                <td>{c.customer}</td>
                <td><span className="chip">{c.project ? `${c.project.code} · ${c.project.name}` : projLabel(c.projectId)}</span></td>
                <td className="num">{money(c.value)}</td>
                <td>שוטף+{c.paymentTerms}</td>
                <td className="num">{c.retentionPct}%</td>
                <td className="num">{money(c.billed)}</td>
                <td className="num">{money(c.collected)}</td>
                <td className="num" style={{ color: c.open > 0 ? 'var(--red)' : 'var(--muted)' }}>{money(c.open)}</td>
                <td><span className={`badge ${c.status === 'פעיל' ? 'b-ok' : 'b-gray'}`}>{c.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <header>
              <h3>{editId ? 'עריכת חוזה' : 'חוזה חדש'}</h3>
              <button className="x" onClick={() => setOpen(false)}>×</button>
            </header>
            <div className="body">
              {formErr && <div className="err">{formErr}</div>}
              <div className="grid2">
                <label className="fld"><span>מספר חוזה</span><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="C-26-0xx" /></label>
                <label className="fld"><span>לקוח</span>
                  <input list="cust-list" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="שם לקוח" />
                  <datalist id="cust-list">{customers.map((c) => <option key={c.id} value={c.name} />)}</datalist>
                </label>
              </div>
              <div className="grid2" style={{ marginTop: 14 }}>
                <label className="fld"><span>פרויקט</span>
                  <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ width: '100%' }}>
                    <option value="">בחר פרויקט…</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
                  </select>
                </label>
                <label className="fld"><span>ערך חוזה (לפני מע"מ)</span><input type="number" value={value} onChange={(e) => setValue(e.target.value === '' ? '' : Number(e.target.value))} /></label>
              </div>
              <div className="grid3" style={{ marginTop: 14 }}>
                <label className="fld"><span>תנאי תשלום</span>
                  <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} style={{ width: '100%' }}>
                    {TERMS.map((t) => <option key={t} value={t}>שוטף+{t}</option>)}
                  </select>
                </label>
                <label className="fld"><span>עכבון %</span><input type="number" value={retentionPct} onChange={(e) => setRetentionPct(e.target.value === '' ? '' : Number(e.target.value))} /></label>
                <label className="fld"><span>סטטוס</span>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: '100%' }}>
                    <option>פעיל</option><option>הושלם</option><option>מוקפא</option>
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

      {custOpen && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setCustOpen(false)}>
          <div className="modal">
            <header>
              <h3>ניהול לקוחות</h3>
              <button className="x" onClick={() => setCustOpen(false)}>×</button>
            </header>
            <div className="body">
              <p className="sub2" style={{ marginTop: 0, fontSize: 12 }}>
                הוספה, עריכה ומחיקה של לקוחות. לא ניתן למחוק לקוח המקושר לחוזים — יש למחוק תחילה את החוזים של הלקוח.
              </p>
              <div className="toolbar" style={{ marginBottom: 10 }}>
                <div className="grow"><input placeholder="חיפוש לקוח לפי שם / ע.מ…" value={custSearch} onChange={(e) => setCustSearch(e.target.value)} /></div>
                <span className="sub2" style={{ margin: 0, fontSize: 12 }}>{customers.length} לקוחות</span>
              </div>
              <div className="panel" style={{ boxShadow: 'none', maxHeight: '44vh', overflow: 'auto' }}>
                <table>
                  <thead><tr><th>שם הלקוח</th><th>ח.פ / ע.מ</th><th></th></tr></thead>
                  <tbody>
                    {customers.filter((c) => { const q = custSearch.trim(); if (!q) return true; return c.name.includes(q) || (c.taxId ?? '').includes(q); }).slice(0, 200).map((c) => {
                      const e = custEdits[c.id] || {};
                      return (
                        <tr key={c.id}>
                          <td><input value={e.name ?? ''} onChange={(ev) => setCustField(c.id, 'name', ev.target.value)} style={{ width: 240 }} /></td>
                          <td><input value={e.taxId ?? ''} onChange={(ev) => setCustField(c.id, 'taxId', ev.target.value)} style={{ width: 120 }} /></td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <button className="btn sm" onClick={() => saveCustomer(c.id)} disabled={custBusy === c.id}>{custBusy === c.id ? '…' : 'שמור'}</button>
                            {canDelete && <button className="btn sm ghost" style={{ color: 'var(--red)', marginInlineStart: 4 }} onClick={() => deleteCustomer(c.id)} disabled={custBusy === c.id}>מחק</button>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="panel pad" style={{ boxShadow: 'none', marginTop: 12 }}>
                <div className="strong" style={{ fontSize: 13, marginBottom: 8 }}>הוספת לקוח חדש</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <label className="fld" style={{ margin: 0, flex: 1, minWidth: 180 }}><span>שם הלקוח</span><input value={ncName} onChange={(e) => setNcName(e.target.value)} /></label>
                  <label className="fld" style={{ margin: 0 }}><span>ח.פ / ע.מ</span><input value={ncTax} onChange={(e) => setNcTax(e.target.value)} style={{ width: 130 }} /></label>
                  <button className="btn" onClick={addCustomer} disabled={custBusy === 'new'}>{custBusy === 'new' ? '…' : '＋ הוסף'}</button>
                </div>
              </div>
              {custMsg && <div className="sub2" style={{ marginTop: 10, color: custMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{custMsg}</div>}
            </div>
            <footer>
              <span className="sub2" style={{ margin: 0, fontSize: 12 }}>לקוחות חדשים נוצרים גם אוטומטית בעת יצירת חוזה.</span>
              <button className="btn" onClick={() => setCustOpen(false)}>סגירה</button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
