import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { MENUS } from '../types';

export default function Layout() {
  const { me, logout, can } = useAuth();
  const visibleMenus = MENUS.filter((m) => can(m.key, 'view'));

  return (
    <>
      <header className="top">
        <img className="logo" src="/logo.png" alt="<CompLTDNamePlaceHolder>" />
        <nav>
          {visibleMenus.map((m) => (
            <NavLink key={m.key} to={m.path} end={m.path === '/'}
              className={({ isActive }) => (isActive ? 'active' : '')}>
              {m.label}
            </NavLink>
          ))}
        </nav>
        <div className="spacer" />
        <div className="userchip">
          <div style={{ textAlign: 'left' }}>
            <div className="strong">{me?.name}</div>
            <div className="role">{me?.roleName}</div>
          </div>
          <span className="avatar">{me?.name?.trim()[0]}</span>
          <button className="lg-btn" onClick={logout}>התנתק</button>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="ip">
        © 2026 <CompLTDNamePlaceHolder>. כל הזכויות שמורות. מערכת זו קניין רוחני בלעדי של <CompNamePlaceHolder>, סודי ומיועד למורשים בלבד.
      </footer>
    </>
  );
}
