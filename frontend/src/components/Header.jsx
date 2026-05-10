import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from './Icon.jsx'

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function Header({ actions }) {
  const { user, logout } = useAuth()
  const location = useLocation()

  const navLink = (to, label, iconName) => {
    const active = location.pathname === to
    return (
      <Link
        to={to}
        className={`header__nav-link ${active ? 'is-active' : ''}`}
      >
        <Icon name={iconName} size={16} />
        <span className="header__nav-label">{label}</span>
      </Link>
    )
  }

  return (
    <header className="header">
      <Link to="/" className="header__brand">
        <img
          src="/contigo-bot.jpeg"
          alt="Contigo"
          className="header__brand-img"
        />
        <div>
          <div className="header__title">Contigo</div>
          <div className="header__subtitle">Aquí Estoy</div>
        </div>
      </Link>

      <div className="header__actions">
        {user ? (
          <>
            {navLink('/chat',     'Chat',      'chat')}
            {navLink('/goals',    'Objetivos', 'target')}
            {navLink('/timeline', 'Timeline',  'heatmap')}
            {actions}
            <div className="header__user">
              <div className="header__avatar">{initials(user.name)}</div>
            </div>
            <button className="btn btn--ghost btn--sm header__logout" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión">
              <Icon name="logout" size={18} />
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
