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
        fontSize: '0.875rem',
        fontWeight: 600,
        color: location.pathname === to ? 'var(--teal-dark)' : 'var(--slate)',
        textDecoration: 'none',
        padding: '5px 10px',
        borderRadius: 8,
        background: location.pathname === to ? 'var(--teal-pale)' : 'transparent',
        transition: 'all 0.15s'
      }}
    >
      {label}
    </Link>
  )

  return (
    <header className="header">
      <Link to="/" className="header__brand">
        <img
          src="/contigo-bot.jpeg"
          alt="Contigo"
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            objectFit: 'cover',
            border: '2px solid rgba(255,255,255,0.6)',
            boxShadow: 'var(--shadow-sm)',
            flexShrink: 0
          }}
        />
        <div>
          <div className="header__title" style={{ fontSize: '1.2rem', color: 'var(--navy)' }}>Contigo</div>
          <div className="header__subtitle" style={{ fontSize: '0.75rem', color: 'var(--teal-dark)', fontWeight: 600 }}>Aquí Estoy</div>
        </div>
      </Link>

      <div className="header__actions">
        {user ? (
          <>
            {navLink('/chat',  '💬 Chat')}
            {navLink('/goals', '🎯 Objetivos')}
            {actions}
            <div className="header__user" style={{ marginLeft: 8, paddingLeft: 12, borderLeft: '1px solid var(--border)' }}>
              <div className="header__avatar" style={{ boxShadow: 'var(--shadow-sm)' }}>{initials(user.name)}</div>
              <span style={{ display: 'none' /* ocultar nombre en móviles para ahorrar espacio */ }} className="hide-on-mobile">{user.name.split(' ')[0]}</span>
            </div>
            <button className="btn btn--ghost btn--sm" onClick={logout} title="Cerrar sesión">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
          </>
        ) : (
          <>
            <Link to="/login"    className="btn btn--outline btn--sm" style={{ background: 'var(--glass-bg)' }}>Iniciar sesión</Link>
            <Link to="/register" className="btn btn--primary btn--sm">Crear cuenta</Link>
          </>
        )}
      </div>
    </header>
  )
}
