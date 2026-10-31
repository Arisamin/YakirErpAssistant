import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { CollectionsData, CollectionItem } from '../types';
import { money, fmt, dmy } from '../lib/finance';

const ACTION_TYPES = ['שיחה טלפונית', 'נשלחה תזכורת מייל', 'נשלח מכתב התראה', 'הבטחת תשלום', 'במחלוקת', 'הועבר לטיפול משפטי'];

export default function Collections() {
  const { can } = useAuth();
  const canWrite = can('collections', 'write');

  const [data, setData] = useState<CollectionsData | null>(null);
  const [err, setErr] = useState('');
  const [ageFilter, setAgeFilter] = useState<number | null>(null);
  const [custFilter, setCustFilter] = useState('');

  // מודל תיעוד פעולה
  const [actDoc, setActDoc] = useState<CollectionItem | null>(null);
  const [aType, setAType] = useState(ACTION_TYPES[0]);
  const [aDate, setADate] = useState('');
  const [aNote, setANote] = useState('');
  const [aNext, setANext] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setData(await api.collections());
    } catch (e) {
      setErr((e as Error).message || 'שגיאה בטעינת הנתונים');
    }
  }
  useEffect(() => {
    load();
  }, []);

  const customers = useMemo(() => [...new Set(data?.items.map((i) => i.customer) ?? [])], [data]);

  const rows = (data?.items ?? []).filter((i) => {
    if (ageFilter !== null && i.bucket !== ageFilter) return false;
    if (custFilter && i.customer !== custFilter) return false;
    return true;
  });

  function openAction(item: CollectionItem) {
    setActDoc(item);
    setAType(ACTION_TYPES[0]);
    setADate(new Date().toISOString().slice(0, 10));
    setANote('');
    setANext('');
  }

  async function saveAction() {
    if (!actDoc) return;
    setSaving(true);
    try {
      await api.addCollectionAction(actDoc.id, { actionType: aType, actionDate: aDate, note: aNote, nextFollowup: aNext || undefined });
      setActDoc(null);
      await load();
    } catch (e) {
      alert((e as Error).message || 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  }

  if (err) return <div className="center-msg">{err}</div>;
  if (!data) return <div className="center-msg">טוען…</div>;

  return (
    <>
      <h2 className="title">גביית חובות פתוחים</h2>
      <p className="sub2">דוח גיול חובות — יתרות פתוחות של חשבוניות מס שחלף מועד תשלומן</p>

      <div className="aging-cards">
        {data.buckets.map((b) => (
          <div key={b.k} className={`age-card age-${b.k} ${ageFilter === b.k ? 'sel' : ''}`} onClick={() => setAgeFilter(ageFilter === b.k ? null : b.k)}>
            <div className="al">{b.label}</div>
            <div className="av">{fmt(b.total)}</div>
            <div className="ac">{b.count} חוב' · ₪</div>
          </div>
        ))}
      </div>

      <div className="toolbar">
        <div className="grow muted">סה"כ בפיגור: <b style={{ color: 'var(--red)' }}>{money(data.overdueTotal)}</b> · לפי דחיפות</div>
        <select value={custFilter} onChange={(e) => setCustFilter(e.target.value)}>
          <option value="">כל הלקוחות</option>
          {customers.map((c) => <option key={c}>{c}</option>)}
        </select>
        {ageFilter !== null && <button className="btn ghost sm" onClick={() => setAgeFilter(null)}>נקה סינון</button>}
      </div>

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>לקוח</th><th>פרויקט</th><th>מסמך</th><th>נטו</th><th>נגבה</th>
              <th>יתרה פתוחה</th><th>לתשלום עד</th><th>פיגור</th><th>פעולת גבייה</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40 }} className="muted">אין חובות בסינון זה 🎉</td></tr>
            )}
            {rows.map((i) => (
              <tr key={i.id}>
                <td className="strong">{i.customer}</td>
                <td><span className="chip">{i.project}</span></td>
                <td><span className="doctype dt-mas">{i.number}</span></td>
                <td className="num">{money(i.net)}</td>
                <td className="num">{i.paid ? money(i.paid) : '—'}</td>
                <td className="num strong" style={{ color: 'var(--red)' }}>{money(i.open)}</td>
                <td className="num">{dmy(i.dueDate)}</td>
                <td><span className={`days-pill dp-${i.bucket}`}>{i.daysOverdue > 0 ? `${i.daysOverdue} י'` : 'טרם'}</span></td>
                <td>
                  {i.lastAction ? (
                    <div className="action-note"><b>{i.lastAction.type}</b> · {dmy(i.lastAction.date)}{i.lastAction.next ? <><br />מעקב: {dmy(i.lastAction.next)}</> : null}</div>
                  ) : <span className="muted" style={{ fontSize: 12 }}>— אין —</span>}
                </td>
                <td>{canWrite && <button className="btn ghost sm" onClick={() => openAction(i)}>תיעוד</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {actDoc && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setActDoc(null)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <header><h3>תיעוד פעולת גבייה</h3><button className="x" onClick={() => setActDoc(null)}>×</button></header>
            <div className="body">
              <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                <div className="strong">{actDoc.customer} · {actDoc.number}</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>יתרה פתוחה: <b style={{ color: 'var(--red)' }}>{money(actDoc.open)}</b> · {actDoc.daysOverdue} ימי פיגור</div>
              </div>
              <div className="grid2">
                <label className="fld"><span>סוג פעולה</span>
                  <select value={aType} onChange={(e) => setAType(e.target.value)} style={{ width: '100%' }}>
                    {ACTION_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </label>
                <label className="fld"><span>תאריך</span><input type="date" value={aDate} onChange={(e) => setADate(e.target.value)} /></label>
              </div>
              <label className="fld" style={{ marginTop: 14 }}><span>הערה</span><input value={aNote} onChange={(e) => setANote(e.target.value)} placeholder="פרטי השיחה / התחייבות הלקוח…" /></label>
              <label className="fld" style={{ marginTop: 14 }}><span>תזכורת למעקב הבא</span><input type="date" value={aNext} onChange={(e) => setANext(e.target.value)} /></label>
            </div>
            <footer><span className="sub2" style={{ margin: 0, fontSize: 12 }}>הפעולה תישמר על החוב</span>
              <button className="btn" onClick={saveAction} disabled={saving}>{saving ? 'שומר…' : 'שמירה'}</button></footer>
          </div>
        </div>
      )}
    </>
  );
}
