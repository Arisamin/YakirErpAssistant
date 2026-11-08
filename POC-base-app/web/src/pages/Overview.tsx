import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { OverviewData, Project } from '../types';
import { money, fmt } from '../lib/finance';

export default function Overview() {
  const { can } = useAuth();
  const canWrite = can('import', 'write');
  const canDelete = can('import', 'delete');
  const [data, setData] = useState<OverviewData | null>(null);
  const [err, setErr] = useState('');
  const navigate = useNavigate();

  // ניהול פרויקטים
  const [projOpen, setProjOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [edits, setEdits] = useState<Record<string, Partial<Project>>>({});
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [nCode, setNCode] = useState('');
  const [nName, setNName] = useState('');
  const [nBudget, setNBudget] = useState<number | ''>('');

  useEffect(() => {
    api.overview().then(setData).catch((e) => setErr(e.message || 'שגיאה בטעינת הנתונים'));
  }, []);

  async function openProjects() {
    setMsg(''); setProjOpen(true);
    try {
      const p = await api.projects();
      setProjects(p);
      const init: Record<string, Partial<Project>> = {};
      p.forEach((x) => { init[x.id] = { code: x.code, name: x.name, costBudget: Number(x.costBudget) || 0, status: x.status }; });
      setEdits(init);
    } catch (e) { setMsg((e as Error).message || 'שגיאה בטעינה'); }
  }
  function setField(id: string, k: keyof Project, v: string) {
    setEdits((e) => ({ ...e, [id]: { ...e[id], [k]: v } }));
  }
  async function saveProject(id: string) {
    setBusy(id); setMsg('');
    try {
      const e = edits[id] || {};
      const up = await api.updateProject(id, { code: e.code, name: e.name, costBudget: Number(e.costBudget) || 0, status: e.status });
      setProjects((ps) => ps.map((p) => (p.id === id ? up : p)));
      setMsg('✓ נשמר: ' + (e.name || ''));
    } catch (err) { setMsg((err as Error).message || 'שגיאה בשמירה'); }
    finally { setBusy(''); }
  }
  async function deleteProject(id: string) {
    const p = projects.find((x) => x.id === id);
    if (!confirm(`למחוק את הפרויקט "${p?.code} · ${p?.name}"? פעולה זו בלתי הפיכה. (ניתן למחוק רק פרויקט ללא חשבוניות, חוזים או ימי עבודה מקושרים.)`)) return;
    setBusy(id); setMsg('');
    try {
      await api.deleteProject(id);
      setProjects((ps) => ps.filter((x) => x.id !== id));
      setMsg('✓ הפרויקט נמחק');
    } catch (err) { setMsg((err as Error).message || 'שגיאה במחיקה'); }
    finally { setBusy(''); }
  }
  async function addProject() {
    if (!nCode.trim() || !nName.trim()) { setMsg('נא למלא קוד ושם פרויקט'); return; }
    setBusy('new'); setMsg('');
    try {
      const p = await api.createProject({ code: nCode.trim(), name: nName.trim(), costBudget: Number(nBudget) || 0 });
      setProjects((ps) => [...ps, p]);
      setEdits((e) => ({ ...e, [p.id]: { code: p.code, name: p.name, costBudget: Number(p.costBudget) || 0, status: p.status } }));
      setNCode(''); setNName(''); setNBudget('');
      setMsg('✓ פרויקט נוסף: ' + p.name);
    } catch (err) { setMsg((err as Error).message || 'שגיאה בהוספה'); }
    finally { setBusy(''); }
  }

  if (err) return <div className="center-msg">{err}</div>;
  if (!data) return <div className="center-msg">טוען…</div>;

  const t = data.totals;

  return (
    <>
      <div className="row-between">
        <div>
          <h2 className="title">סקירת פרויקטים — רווחיות</h2>
          <p className="sub2">תמונה מלאה לכל פרויקט: הכנסות מול הוצאות (חומרים + עבודה) וביצוע מול תקציב</p>
        </div>
        {canWrite && <button className="btn ghost" onClick={openProjects}>🗂 ניהול פרויקטים</button>}
      </div>

      <div className="cards">
        <div className="stat"><div className="k">הכנסה מוכרת</div><div className="v">{fmt(t.income)} <small>₪</small></div></div>
        <div className="stat">
          <div className="k">עלות בפועל</div>
          <div className="v">{fmt(t.cost)} <small>₪</small></div>
          <div className="sub2" style={{ margin: '2px 0 0', fontSize: 11 }}>חומרים {fmt(t.materials)} · עבודה {fmt(t.labor)}</div>
        </div>
        <div className="stat"><div className="k">רווח גולמי</div><div className={`v ${t.profit >= 0 ? 'pos' : 'neg'}`}>{fmt(t.profit)} <small>₪</small></div></div>
        <div className="stat"><div className="k">שיעור רווח</div><div className={`v ${t.profit >= 0 ? 'pos' : 'neg'}`}>{t.margin.toFixed(1)}<small>%</small></div></div>
        <div className="stat"><div className="k">תקציב עלות כולל</div><div className="v">{fmt(t.costBudget)} <small>₪</small></div></div>
      </div>

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>פרויקט</th><th>הכנסה מוכרת</th><th>חומרים / קבלנים</th><th>עבודה</th>
              <th>סה"כ עלות</th><th>רווח</th><th>שיעור רווח</th><th>תקציב עלות</th><th>ניצול</th><th>רווחיות</th>
            </tr>
          </thead>
          <tbody>
            {data.projects.map((r) => {
              const pc = r.profit >= 0 ? 'pos' : 'neg';
              const utilColor = r.utilization > 100 ? 'var(--red)' : r.utilization > 85 ? 'var(--warn)' : 'var(--green)';
              const barInc = Math.max(r.income, 1);
              return (
                <tr key={r.id} className="click" onClick={() => navigate('/reports')}>
                  <td className="strong">{r.code} · {r.name}</td>
                  <td className="num">{money(r.income)}</td>
                  <td className="num">{money(r.materials)}</td>
                  <td className="num">{money(r.labor)}</td>
                  <td className="num">{money(r.cost)}</td>
                  <td className={`num ${pc}`}>{money(r.profit)}</td>
                  <td className={`num ${pc}`}>{r.margin.toFixed(1)}%</td>
                  <td className="num muted">{money(r.costBudget)}</td>
                  <td style={{ minWidth: 90 }}>
                    <span className="num" style={{ color: utilColor }}>{r.utilization.toFixed(0)}%</span>
                    <div className="mini-bar"><i style={{ width: `${Math.min(100, r.utilization)}%`, background: utilColor }} /></div>
                  </td>
                  <td style={{ minWidth: 120 }}>
                    <div className="profit-bar">
                      <span style={{ width: `${(r.cost / barInc) * 100}%`, background: '#d99a2b' }} />
                      <span style={{ width: `${(Math.max(0, r.profit) / barInc) * 100}%`, background: 'var(--green)' }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="sub2" style={{ marginTop: 10, fontSize: 12 }}>
        * הכנסה מוכרת = סכום חשבוניות המס (לפני מע"מ). עלות = חשבוניות ספקים משויכות + עלות ימי עבודה. לחיצה על שורה עוברת לדוחות החיתוך.
      </p>

      {projOpen && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setProjOpen(false)}>
          <div className="modal">
            <header>
              <h3>ניהול פרויקטים</h3>
              <button className="x" onClick={() => setProjOpen(false)}>×</button>
            </header>
            <div className="body">
              <p className="sub2" style={{ marginTop: 0, fontSize: 12 }}>
                הוספה, עריכה ומחיקה של פרויקטים. לא ניתן למחוק פרויקט המקושר לחשבוניות ספק, חוזים או ימי עבודה — יש להסיר תחילה את התנועות.
              </p>
              <div className="panel" style={{ boxShadow: 'none', maxHeight: '46vh', overflow: 'auto' }}>
                <table>
                  <thead><tr><th>קוד</th><th>שם הפרויקט</th><th>תקציב עלות (₪)</th><th>סטטוס</th><th></th></tr></thead>
                  <tbody>
                    {projects.map((p) => {
                      const e = edits[p.id] || {};
                      return (
                        <tr key={p.id}>
                          <td><input value={e.code ?? ''} onChange={(ev) => setField(p.id, 'code', ev.target.value)} style={{ width: 70 }} /></td>
                          <td><input value={e.name ?? ''} onChange={(ev) => setField(p.id, 'name', ev.target.value)} style={{ width: 200 }} /></td>
                          <td><input type="number" value={(e.costBudget as number) ?? 0} onChange={(ev) => setField(p.id, 'costBudget', ev.target.value)} style={{ width: 120 }} /></td>
                          <td>
                            <select value={e.status ?? 'פעיל'} onChange={(ev) => setField(p.id, 'status', ev.target.value)}>
                              <option value="פעיל">פעיל</option>
                              <option value="הסתיים">הסתיים</option>
                              <option value="מוקפא">מוקפא</option>
                            </select>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <button className="btn sm" onClick={() => saveProject(p.id)} disabled={busy === p.id}>{busy === p.id ? '…' : 'שמור'}</button>
                            {canDelete && <button className="btn sm ghost" style={{ color: 'var(--red)', marginInlineStart: 4 }} onClick={() => deleteProject(p.id)} disabled={busy === p.id}>מחק</button>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="panel pad" style={{ boxShadow: 'none', marginTop: 12 }}>
                <div className="strong" style={{ fontSize: 13, marginBottom: 8 }}>הוספת פרויקט חדש</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <label className="fld" style={{ margin: 0 }}><span>קוד</span><input value={nCode} onChange={(e) => setNCode(e.target.value)} style={{ width: 80 }} placeholder="104" /></label>
                  <label className="fld" style={{ margin: 0, flex: 1, minWidth: 160 }}><span>שם הפרויקט</span><input value={nName} onChange={(e) => setNName(e.target.value)} /></label>
                  <label className="fld" style={{ margin: 0 }}><span>תקציב עלות (₪)</span><input type="number" value={nBudget} onChange={(e) => setNBudget(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: 130 }} /></label>
                  <button className="btn" onClick={addProject} disabled={busy === 'new'}>{busy === 'new' ? '…' : '＋ הוסף'}</button>
                </div>
              </div>
              {msg && <div className="sub2" style={{ marginTop: 10, color: msg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{msg}</div>}
            </div>
            <footer>
              <span className="sub2" style={{ margin: 0, fontSize: 12 }}>{projects.length} פרויקטים</span>
              <button className="btn" onClick={() => setProjOpen(false)}>סגירה</button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
