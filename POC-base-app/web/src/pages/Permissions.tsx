import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { MENUS } from '../types';
import type { UserRow, RolePerm, FieldSetting, OrgSettings } from '../types';

type Act = 'view' | 'write' | 'delete';

export default function Permissions() {
  const { me, reloadMe } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RolePerm[]>([]);
  const [fieldSettings, setFieldSettings] = useState<FieldSetting[]>([]);
  const [fieldMsg, setFieldMsg] = useState('');
  const [org, setOrg] = useState<OrgSettings>({ masavInstitutionCode: '', masavSenderName: '', openingBalance: 0 });
  const [orgMsg, setOrgMsg] = useState('');
  const [orgBusy, setOrgBusy] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  // הוספת משתמש
  const [addOpen, setAddOpen] = useState(false);
  const [nName, setNName] = useState('');
  const [nEmail, setNEmail] = useState('');
  const [nPass, setNPass] = useState('');
  const [nRole, setNRole] = useState('');
  const [nStatus, setNStatus] = useState('APPROVED');
  const [formErr, setFormErr] = useState('');

  // 2FA
  const [twofa, setTwofa] = useState<{ secret: string; otpauth: string } | null>(null);
  const [twofaCode, setTwofaCode] = useState('');
  const [twofaMsg, setTwofaMsg] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [u, r, fs, os] = await Promise.all([api.users(), api.roles(), api.invoiceFieldSettings(), api.orgSettings()]);
      setUsers(u);
      setRoles(r);
      setFieldSettings(fs);
      setOrg(os);
      if (r[0]) setNRole(r[0].key);
    } catch (e) {
      setErr((e as Error).message || 'שגיאה בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const permOf = (roleKey: string, menuKey: string) =>
    roles.find((r) => r.key === roleKey)?.permissions.find((p) => p.menuKey === menuKey) ?? { menuKey, view: false, write: false, delete: false };

  async function togglePerm(roleKey: string, menuKey: string, act: Act, checked: boolean) {
    const cur = permOf(roleKey, menuKey);
    const next = { view: cur.view, write: cur.write, delete: cur.delete, [act]: checked } as { view: boolean; write: boolean; delete: boolean };
    if ((act === 'write' || act === 'delete') && checked) next.view = true; // כתיבה/מחיקה מחייבות צפייה
    // עדכון אופטימי
    setRoles((rs) => rs.map((r) => (r.key === roleKey ? { ...r, permissions: r.permissions.map((p) => (p.menuKey === menuKey ? { menuKey, ...next } : p)) } : r)));
    try {
      await api.setPermission({ roleKey, menuKey, view: next.view, write: next.write, del: next.delete });
      if (me?.role === roleKey) await reloadMe(); // ריענון התפריט אם זה התפקיד שלי
    } catch (e) {
      alert((e as Error).message || 'שגיאה');
      load();
    }
  }

  async function changeUserRole(id: string, roleKey: string) {
    await api.updateUser(id, { roleKey });
    await load();
    const u = users.find((x) => x.id === id);
    if (u && u.email === me?.email) await reloadMe();
  }
  async function toggleApprove(u: UserRow) {
    await api.updateUser(u.id, { status: u.status === 'APPROVED' ? 'DISABLED' : 'APPROVED' });
    await load();
  }

  async function addUser() {
    setFormErr('');
    if (!nName || !nEmail || nPass.length < 8) {
      setFormErr('נא למלא שם, דוא"ל וסיסמה (8 תווים לפחות)');
      return;
    }
    try {
      await api.createUser({ name: nName, email: nEmail, password: nPass, roleKey: nRole, status: nStatus });
      setAddOpen(false);
      setNName(''); setNEmail(''); setNPass('');
      await load();
    } catch (e) {
      setFormErr((e as Error).message || 'שגיאה');
    }
  }

  async function toggleFieldRequired(fieldKey: string, required: boolean) {
    setFieldMsg('');
    // עדכון אופטימי
    setFieldSettings((fs) => fs.map((f) => (f.fieldKey === fieldKey ? { ...f, required } : f)));
    try {
      await api.setInvoiceFieldSetting(fieldKey, required);
      setFieldMsg('✓ נשמר');
    } catch (e) {
      setFieldMsg((e as Error).message || 'שגיאה');
      load();
    }
  }

  async function saveOrg() {
    setOrgBusy(true); setOrgMsg('');
    try {
      const saved = await api.setOrgSettings(org);
      setOrg(saved);
      setOrgMsg('✓ ההגדרות נשמרו');
    } catch (e) {
      setOrgMsg((e as Error).message || 'שגיאה בשמירה');
    } finally {
      setOrgBusy(false);
    }
  }

  async function start2fa() {
    setTwofaMsg('');
    setTwofa(await api.setup2fa());
  }
  async function confirm2fa() {
    try {
      await api.enable2fa(twofaCode);
      setTwofa(null);
      setTwofaCode('');
      setTwofaMsg('✓ אימות דו-שלבי הופעל בהצלחה');
      await reloadMe();
    } catch (e) {
      setTwofaMsg((e as Error).message || 'קוד שגוי');
    }
  }

  if (loading) return <div className="center-msg">טוען…</div>;
  if (err) return <div className="center-msg">{err}</div>;

  const statusLabel: Record<string, string> = { APPROVED: '✓ מאושר', PENDING: '⏳ ממתין', DISABLED: '⛔ מושבת' };

  return (
    <>
      <h2 className="title">ניהול הרשאות ומשתמשים</h2>
      <p className="sub2">אישור משתמשים והגדרה מדויקת — לכל תפקיד, לכל תפריט — של הרשאות צפייה, כתיבה ומחיקה</p>

      {/* אבטחת החשבון שלי */}
      <div className="panel pad" style={{ marginBottom: 22 }}>
        <div className="row-between">
          <div>
            <div className="strong">אבטחת החשבון שלי — אימות דו-שלבי (2FA)</div>
            <div className="sub2" style={{ margin: '2px 0 0', fontSize: 12 }}>{me?.mfaEnabled ? 'אימות דו-שלבי מופעל בחשבונך.' : 'מומלץ להפעיל אימות דו-שלבי לאבטחה מוגברת.'}</div>
          </div>
          {!me?.mfaEnabled && !twofa && <button className="btn sm" onClick={start2fa}>הפעל אימות דו-שלבי</button>}
          {me?.mfaEnabled && <span className="badge b-ok">מופעל</span>}
        </div>
        {twofa && (
          <div style={{ marginTop: 12, background: 'var(--bg)', borderRadius: 9, padding: 14 }}>
            <div className="sub2" style={{ margin: 0, fontSize: 12 }}>הוסף את המפתח באפליקציית אימות (Google Authenticator / Microsoft Authenticator):</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 700, margin: '8px 0', direction: 'ltr', textAlign: 'right' }}>{twofa.secret}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', maxWidth: 320 }}>
              <label className="fld" style={{ margin: 0, flex: 1 }}><span>הזן קוד מהאפליקציה</span><input value={twofaCode} onChange={(e) => setTwofaCode(e.target.value)} placeholder="6 ספרות" /></label>
              <button className="btn sm" onClick={confirm2fa}>אישור</button>
            </div>
          </div>
        )}
        {twofaMsg && <div className="sub2" style={{ marginTop: 8, color: twofaMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{twofaMsg}</div>}
      </div>

      {/* משתמשים */}
      <div className="row-between" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>משתמשים מאושרים</h3>
        <button className="btn sm" onClick={() => setAddOpen(true)}>＋ הוסף משתמש</button>
      </div>
      <div className="panel" style={{ marginBottom: 24 }}>
        <table>
          <thead><tr><th>שם</th><th>דוא"ל</th><th>תפקיד</th><th>סטטוס</th><th>2FA</th><th>פעולות</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="strong">{u.name}</td>
                <td className="muted">{u.email}</td>
                <td>
                  <select value={u.role} onChange={(e) => changeUserRole(u.id, e.target.value)}>
                    {roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
                  </select>
                </td>
                <td><span className={`status-${u.status}`}>{statusLabel[u.status] ?? u.status}</span></td>
                <td>{u.mfaEnabled ? <span className="badge b-ok">מופעל</span> : <span className="muted" style={{ fontSize: 12 }}>—</span>}</td>
                <td><button className="btn ghost sm" onClick={() => toggleApprove(u)}>{u.status === 'APPROVED' ? 'השבת' : 'אשר'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* מטריצת הרשאות */}
      <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>מטריצת הרשאות — תפקיד × תפריט</h3>
      <div className="panel pad">
        <div style={{ overflowX: 'auto' }}>
          <table className="perm-matrix">
            <thead>
              <tr>
                <th>תפריט</th>
                {roles.map((r) => <th key={r.key} className="role-h">{r.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {MENUS.map((m) => (
                <tr key={m.key}>
                  <td>{m.label}</td>
                  {roles.map((r) => {
                    const p = permOf(r.key, m.key);
                    const dis = r.key === 'admin';
                    return (
                      <td key={r.key}>
                        <div className="perm-cell">
                          <label><input type="checkbox" checked={p.view} disabled={dis} onChange={(e) => togglePerm(r.key, m.key, 'view', e.target.checked)} />צפייה</label>
                          <label><input type="checkbox" checked={p.write} disabled={dis} onChange={(e) => togglePerm(r.key, m.key, 'write', e.target.checked)} />כתיבה</label>
                          <label><input type="checkbox" checked={p.delete} disabled={dis} onChange={(e) => togglePerm(r.key, m.key, 'delete', e.target.checked)} />מחיקה</label>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="sub2" style={{ marginTop: 12, fontSize: 12 }}>🔒 ההרשאות נאכפות בשרת בכל פעולה — לא רק בתצוגה. תפקיד "מנהל מערכת" נעול להרשאות מלאות. שינוי נשמר מיד.</p>
      </div>

      {/* שדות חובה לאישור חשבונית ספק */}
      <h3 style={{ margin: '28px 0 12px', fontSize: 15 }}>שדות חובה לאישור חשבונית ספק</h3>
      <div className="panel pad">
        <p className="sub2" style={{ marginTop: 0, fontSize: 12 }}>
          סמן אילו שדות חייבים להיות מלאים כדי שניתן יהיה לאשר חשבונית ספק לתשלום. הכפייה נאכפת גם בשרת — לכל מאשר, בהווה ובעתיד.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 560 }}>
          {fieldSettings.map((f) => (
            <div key={f.fieldKey} className="toggle-row">
              <span>{f.label}</span>
              <label className="switch">
                <input type="checkbox" checked={f.required} onChange={(e) => toggleFieldRequired(f.fieldKey, e.target.checked)} />
                <span className="slider" />
              </label>
            </div>
          ))}
        </div>
        {fieldMsg && <div className="sub2" style={{ marginTop: 10, color: fieldMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{fieldMsg}</div>}
      </div>

      {/* הגדרות מס"ב ותזרים — מוסד שולח */}
      <h3 style={{ margin: '28px 0 12px', fontSize: 15 }}>הגדרות מס"ב ותזרים — מוסד שולח</h3>
      <div className="panel pad">
        <p className="sub2" style={{ marginTop: 0, fontSize: 12 }}>
          קוד "מוסד שולח" מונפק על ידי הבנק ומשמש בכותרת קובץ המס"ב. יתרת הפתיחה משמשת לחישוב היתרה המצטברת בתזרים.
        </p>
        <div className="grid3" style={{ maxWidth: 720 }}>
          <label className="fld"><span>מספר מוסד שולח (8 ספרות)</span>
            <input value={org.masavInstitutionCode} onChange={(e) => setOrg({ ...org, masavInstitutionCode: e.target.value })} placeholder="00000000" />
          </label>
          <label className="fld"><span>שם המוסד השולח</span>
            <input value={org.masavSenderName} onChange={(e) => setOrg({ ...org, masavSenderName: e.target.value })} />
          </label>
          <label className="fld"><span>יתרת פתיחה לתזרים (₪)</span>
            <input type="number" value={org.openingBalance} onChange={(e) => setOrg({ ...org, openingBalance: Number(e.target.value) || 0 })} />
          </label>
        </div>
        {org.masavInstitutionCode === '00000000' && (
          <div className="ro-badge" style={{ display: 'block', marginBottom: 10 }}>⚠ קוד המוסד הוא ערך דוגמה. הזן את הקוד האמיתי שקיבלת מהבנק לפני הפקת מס"ב לייצור.</div>
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn" onClick={saveOrg} disabled={orgBusy}>{orgBusy ? 'שומר…' : 'שמירת הגדרות'}</button>
          {orgMsg && <span className="sub2" style={{ margin: 0, color: orgMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{orgMsg}</span>}
        </div>
      </div>

      {addOpen && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setAddOpen(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <header><h3>משתמש חדש</h3><button className="x" onClick={() => setAddOpen(false)}>×</button></header>
            <div className="body">
              {formErr && <div className="err">{formErr}</div>}
              <div className="grid2">
                <label className="fld"><span>שם</span><input value={nName} onChange={(e) => setNName(e.target.value)} /></label>
                <label className="fld"><span>דוא"ל</span><input type="email" value={nEmail} onChange={(e) => setNEmail(e.target.value)} /></label>
              </div>
              <label className="fld" style={{ marginTop: 14 }}><span>סיסמה (8 תווים לפחות)</span><input type="password" value={nPass} onChange={(e) => setNPass(e.target.value)} /></label>
              <div className="grid2" style={{ marginTop: 14 }}>
                <label className="fld"><span>תפקיד</span><select value={nRole} onChange={(e) => setNRole(e.target.value)} style={{ width: '100%' }}>{roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select></label>
                <label className="fld"><span>סטטוס</span><select value={nStatus} onChange={(e) => setNStatus(e.target.value)} style={{ width: '100%' }}><option value="APPROVED">מאושר</option><option value="PENDING">ממתין לאישור</option></select></label>
              </div>
            </div>
            <footer><span className="sub2" style={{ margin: 0, fontSize: 12 }}>רק משתמשים מאושרים יכולים להתחבר</span><button className="btn" onClick={addUser}>שמירה</button></footer>
          </div>
        </div>
      )}
    </>
  );
}
