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
            width: 40,
            height: 40,
            borderRadius: 12,
            objectFit: 'cover',
            border: '2px solid var(--teal-light)',
            flexShrink: 0
          }}
        />
        <div>
          <div className="header__title">Contigo</div>
          <div className="header__subtitle">Aquí Estoy</div>
        </div>
      </Link>

      <div className="header__actions">
        {user ? (
          <>
            {navLink('/chat',  '💬 Chat')}
            {navLink('/goals', '🎯 Objetivos')}
            {actions}
            <div className="header__user">
              <div className="header__avatar">{initials(user.name)}</div>
              <span>{user.name}</span>
            </div>
            <button className="btn btn--ghost btn--sm" onClick={logout}>
              Salir
            </button>
          </>
        ) : (
          <>
            <Link to="/login"    className="btn btn--outline btn--sm">Iniciar sesión</Link>
            <Link to="/register" className="btn btn--primary btn--sm">Crear cuenta</Link>
          </>
        )}
      </div>
    </header>
  )
}
