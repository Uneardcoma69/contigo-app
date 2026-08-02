import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function Header({ actions }) {
  const { user, logout } = useAuth()
  const location = useLocation()

  const navLink = (to, label) => (
    <Link
      to={to}
      style={{
        fontSize: '0.95rem',
        fontWeight: 700,
        color: location.pathname === to ? 'var(--teal-dark)' : 'var(--slate)',
        textDecoration: 'none',
        padding: '8px 16px',
        borderRadius: 'var(--radius-pill)',
        background: location.pathname === to ? 'var(--teal-pale)' : 'transparent',
        border: location.pathname === to ? '1px solid var(--teal-light)' : '1px solid transparent',
        transition: 'all 0.2s cubic-bezier(0.25, 1, 0.5, 1)'
      }}
    >
      {label}
    </Link>
  )

  return (
    <header className="header" style={{
      margin: '16px auto',
      maxWidth: '1200px',
      borderRadius: 'var(--radius-pill)',
      padding: '12px 24px',
      border: '1px solid var(--border-light)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      top: '16px',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <Link to="/" className="header__brand">
        <img
          src="/contigo-bot.jpeg"
          alt="Contigo"
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            objectFit: 'cover',
            border: '3px solid var(--white)',
            boxShadow: 'var(--shadow-sm)',
            flexShrink: 0
          }}
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
        <div style={{
          display: 'none', width: 48, height: 48, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--teal-light), var(--sage-light))',
          border: '3px solid var(--white)', boxShadow: 'var(--shadow-sm)',
          alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
          flexShrink: 0
        }}>
          🌱
        </div>
        <div>
          <div className="header__title">Contigo</div>
          <div className="header__subtitle" style={{ color: 'var(--teal-dark)' }}>Aquí Estoy</div>
        </div>
      </Link>

      <div className="header__actions">
        {user ? (
          <>
            <div style={{ display: 'flex', gap: '8px', marginRight: '8px' }}>
              {!user.isStaff && navLink('/chat',  '💬 Chat')}
              {!user.isStaff && navLink('/goals', '🎯 Metas')}
              {user.isStaff && navLink('/staff', '🩺 Panel Staff')}
              {user.isAdmin && navLink('/admin', '🛡️ Admin')}
            </div>
            {actions}
            <div className="header__user" style={{ paddingLeft: 16, borderLeft: '2px solid var(--border)', marginLeft: 8 }}>
              <div className="header__avatar">{initials(user.name)}</div>
              <span style={{ display: 'none' }} className="hide-on-mobile">{user.name.split(' ')[0]}</span>
            </div>
            <button className="btn btn--icon" onClick={logout} title="Cerrar sesión" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', marginLeft: '4px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
          </>
        ) : (
          <>
            <Link to="/login"    className="btn btn--outline btn--sm" style={{ border: 'none', background: 'transparent' }}>Iniciar sesión</Link>
            <Link to="/register" className="btn btn--primary btn--sm">Crear cuenta</Link>
          </>
        )}
      </div>
    </header>
  )
}
