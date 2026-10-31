import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [mfa, setMfa] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const { reloadMe } = useAuth();
  const navigate = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await api.login(email, password, mfa ? token : undefined);
      await reloadMe();
      navigate('/');
    } catch (e) {
      const ae = e as ApiError;
      if (ae.mfaRequired) {
        setMfa(true);
        setErr('הזן את קוד האימות הדו-שלבי מהאפליקציה');
      } else {
        setErr(ae.message || 'שגיאה בהתחברות');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <img className="logo" src="/logo.png" alt="אתניב ב.י בע״מ" />
        <h1>ניהול פרויקטלי</h1>
        <p className="sub">כניסה למשתמשים מורשים בלבד</p>

        {err && <div className="err">{err}</div>}

        <label className="fld">
          <span>דוא"ל</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="fld">
          <span>סיסמה</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {mfa && (
          <label className="fld">
            <span>קוד אימות דו-שלבי</span>
            <input
              type="text"
              inputMode="numeric"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="6 ספרות"
            />
          </label>
        )}

        <button className="btn block" disabled={busy} type="submit">
          {busy ? 'מתחבר…' : 'כניסה'}
        </button>

        <div className="note">
          🔒 חיבור מוצפן. המידע קניין רוחני של אתניב ב.י בע"מ, סודי ומיועד למורשים בלבד.
        </div>
      </form>
    </div>
  );
}
