import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { Worker, Project } from '../types';
import { money, fmt, monthLabel } from '../lib/finance';

const key = (workerId: string, projectId: string, month: string) => `${workerId}|${projectId}|${month}`;

export default function Labor() {
  const { can } = useAuth();
  const canWrite = can('labor', 'write');
  const canDelete = can('labor', 'delete');

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [wd, setWd] = useState<Record<string, number>>({});
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // הוספת עובד
  const [addOpen, setAddOpen] = useState(false);
  const [nName, setNName] = useState('');
  const [nRole, setNRole] = useState('');
  const [nCost, setNCost] = useState<number | ''>('');

  async function load() {
    setLoading(true);
    try {
      const [w, days, p] = await Promise.all([api.workers(), api.workdays(), api.projects()]);
      setWorkers(w);
      setProjects(p);
      const map: Record<string, number> = {};
      const ms = new Set<string>();
      days.forEach((d) => {
        map[key(d.workerId, d.projectId, d.month)] = d.days;
        ms.add(d.month);
      });
      setWd(map);
      const now = new Date();
      ms.add(`${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`);
      const sorted = [...ms].sort();
      setMonths(sorted);
      setMonth((cur) => (cur && sorted.includes(cur) ? cur : sorted[sorted.length - 1]));
    } catch (e) {
      setErr((e as Error).message || 'שגיאה בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const getDays = (wId: string, pId: string) => wd[key(wId, pId, month)] ?? 0;

  function setCell(wId: string, pId: string, val: number) {
    setWd((m) => ({ ...m, [key(wId, pId, month)]: val }));
  }
  function persistCell(wId: string, pId: string) {
    if (!canWrite) return;
    api.setWorkday({ workerId: wId, projectId: pId, month, days: getDays(wId, pId) }).catch(() => {});
  }
  function setCost(wId: string, val: number) {
    setWorkers((ws) => ws.map((w) => (w.id === wId ? { ...w, dailyCost: val } : w)));
  }
  function persistCost(wId: string) {
    if (!canWrite) return;
    const w = workers.find((x) => x.id === wId);
    if (w) api.updateWorker(wId, { dailyCost: w.dailyCost }).catch(() => {});
  }

  // סיכומים
  const monthCost = useMemo(
    () => workers.reduce((s, w) => s + projects.reduce((ps, p) => ps + getDays(w.id, p.id) * w.dailyCost, 0), 0),
    [workers, projects, wd, month]
  );
  const cumulativeCost = useMemo(() => {
    let total = 0;
    for (const [k, days] of Object.entries(wd)) {
      const wId = k.split('|')[0];
      const w = workers.find((x) => x.id === wId);
      if (w) total += days * w.dailyCost;
    }
    return total;
  }, [wd, workers]);
  const colTotal = (pId: string) => workers.reduce((s, w) => s + getDays(w.id, pId) * w.dailyCost, 0);

  async function addWorker() {
    if (!nName) return;
    await api.createWorker({ name: nName, role: nRole, dailyCost: Number(nCost) || 0 });
    setAddOpen(false);
    setNName('');
    setNRole('');
    setNCost('');
    await load();
  }

  async function removeWorker(id: string, name: string) {
    if (!confirm(`למחוק את העובד "${name}"? כל רשומות ימי העבודה שלו יימחקו יחד איתו. פעולה זו בלתי הפיכה.`)) return;
    try {
      await api.deleteWorker(id);
      await load();
    } catch (e) {
      alert((e as Error).message || 'שגיאה במחיקת העובד');
    }
  }

  function downloadTemplate() {
    const head = ['עובד', ...projects.map((p) => p.code)];
    const rows = workers.map((w) => [w.name, ...projects.map((p) => getDays(w.id, p.id) || 0)]);
    const ws = XLSX.utils.aoa_to_sheet([head, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ימי עבודה');
    XLSX.writeFile(wb, `ימי_עבודה_${month}.xlsx`);
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const grid = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      const header = (grid[0] || []).map((h) => String(h).trim());
      const rows = grid.slice(1)
        .filter((r) => r && r[0])
        .map((r) => {
          const cells: Record<string, number> = {};
          header.forEach((h, i) => {
            if (i === 0) return;
            const code = String(h).replace(/[^0-9]/g, '');
            const v = Number(r[i]) || 0;
            if (code && v) cells[code] = v;
          });
          return { name: String(r[0]).trim(), cells };
        });
      const res = await api.importWorkdays({ month, rows });
      await load();
      alert(`יובאו ${res.matched} עובדים לחודש ${monthLabel(month)}${res.created ? ` (${res.created} עובדים חדשים נוספו — עדכן להם עלות יומית)` : ''}.`);
    } catch (e) {
      alert('שגיאה בקריאת הקובץ: ' + (e as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (loading) return <div className="center-msg">טוען…</div>;
  if (err) return <div className="center-msg">{err}</div>;

  return (
    <>
      <div className="row-between">
        <div>
          <h2 className="title">עבודה ועובדים</h2>
          <p className="sub2">עלות יומית לכל עובד וריכוז ימי העבודה בפרויקטים — בסיס לחישוב עלות העבודה בפרויקט</p>
        </div>
        {canWrite && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn ghost sm" onClick={downloadTemplate}>⭳ תבנית אקסל</button>
            <label className="btn ghost sm" style={{ cursor: 'pointer' }}>
              ⭱ ייבוא אקסל
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={onImport} />
            </label>
            <button className="btn sm" onClick={() => setAddOpen(true)}>＋ עובד</button>
          </div>
        )}
      </div>

      {!canWrite && <div className="ro-badge">🔒 צפייה בלבד — אין לך הרשאת עריכה במודול זה</div>}

      <div className="cards">
        <div className="stat"><div className="k">עובדים</div><div className="v">{workers.length}</div></div>
        <div className="stat"><div className="k">עלות עבודה — {month && monthLabel(month)}</div><div className="v">{fmt(monthCost)} <small>₪</small></div></div>
        <div className="stat"><div className="k">עלות עבודה מצטברת</div><div className="v">{fmt(cumulativeCost)} <small>₪</small></div></div>
      </div>

      <div className="panel pad">
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <span className="strong">חודש עבודה:</span>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <div className="spacer" />
          <span className="sub2" style={{ margin: 0, fontSize: 12 }}>ערוך ימי עבודה ועלות יומית ישירות בטבלה — השינוי נשמר אוטומטית</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="matrix">
            <thead>
              <tr>
                <th>עובד</th><th>תפקיד</th><th>עלות יומית</th>
                {projects.map((p) => <th key={p.id} title={p.name}>{p.code}</th>)}
                <th>סה"כ ימים</th><th>עלות חודשית</th>
                {canDelete && <th></th>}
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => {
                const days = projects.reduce((s, p) => s + getDays(w.id, p.id), 0);
                return (
                  <tr key={w.id}>
                    <td className="strong">{w.name}</td>
                    <td className="muted">{w.role}</td>
                    <td>
                      <input type="number" value={w.dailyCost || ''} disabled={!canWrite} style={{ width: 80 }}
                        onChange={(e) => setCost(w.id, Number(e.target.value) || 0)} onBlur={() => persistCost(w.id)} />
                    </td>
                    {projects.map((p) => (
                      <td key={p.id}>
                        <input type="number" min={0} value={getDays(w.id, p.id) || ''} disabled={!canWrite}
                          onChange={(e) => setCell(w.id, p.id, Number(e.target.value) || 0)} onBlur={() => persistCell(w.id, p.id)} />
                      </td>
                    ))}
                    <td className="num">{days}</td>
                    <td className="num">{money(days * w.dailyCost)}</td>
                    {canDelete && <td><button className="btn sm ghost" style={{ color: 'var(--red)' }} title="מחיקת עובד" onClick={() => removeWorker(w.id, w.name)}>מחק</button></td>}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>סה"כ עלות עבודה לפרויקט</td>
                {projects.map((p) => <td key={p.id} className="num">{fmt(colTotal(p.id))}</td>)}
                <td />
                <td className="num">{money(monthCost)}</td>
                {canDelete && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <p className="sub2" style={{ marginTop: 10, fontSize: 12 }}>
        💡 הפלט החודשי מאקסל: עמודה ראשונה = שם העובד, עמודות הבאות = מספרי הפרויקטים (101, 102, 103…), הערכים = ימי עבודה. ייבוא מעדכן את החודש הנבחר.
      </p>

      {addOpen && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setAddOpen(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <header><h3>עובד חדש</h3><button className="x" onClick={() => setAddOpen(false)}>×</button></header>
            <div className="body">
              <div className="grid2">
                <label className="fld"><span>שם העובד</span><input value={nName} onChange={(e) => setNName(e.target.value)} /></label>
                <label className="fld"><span>תפקיד</span><input value={nRole} onChange={(e) => setNRole(e.target.value)} /></label>
              </div>
              <label className="fld" style={{ marginTop: 14 }}><span>עלות יומית (₪)</span><input type="number" value={nCost} onChange={(e) => setNCost(e.target.value === '' ? '' : Number(e.target.value))} /></label>
            </div>
            <footer><span className="sub2" style={{ margin: 0, fontSize: 12 }}>העלות היומית משמשת לחישוב עלות העבודה בפרויקט</span>
              <button className="btn" onClick={addWorker}>שמירה</button></footer>
          </div>
        </div>
      )}
    </>
  );
}
