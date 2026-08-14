import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext.jsx'

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function Header({ actions }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [riskAlert, setRiskAlert] = useState({ alto: 0, medio: 0 })

  // Badge de riesgo para el staff: consulta cada 30 s
  useEffect(() => {
    if (!user?.isStaff) return
    let active = true
    const fetchAlerts = () => {
      axios.get('/api/staff/alerts/summary')
        .then(({ data }) => { if (active) setRiskAlert(data) })
        .catch(() => {})
    }
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 30000)
    return () => { active = false; clearInterval(interval) }
  }, [user?.isStaff])

  // El icono y el texto van separados para poder ocultar la palabra en
  // pantallas angostas sin que el enlace pierda su nombre accesible.
  const navLink = (to, icono, texto) => (
    <Link
      to={to}
      aria-label={texto}
      className="header__nav-link"
      style={{
        fontSize: '0.95rem',
        fontWeight: 700,
        color: location.pathname === to ? 'var(--teal-dark)' : 'var(--slate)',
        textDecoration: 'none',
        borderRadius: 'var(--radius-pill)',
        background: location.pathname === to ? 'var(--teal-pale)' : 'transparent',
        border: location.pathname === to ? '1px solid var(--teal-light)' : '1px solid transparent',
        transition: 'all 0.2s cubic-bezier(0.25, 1, 0.5, 1)'
      }}
    >
      <span aria-hidden="true">{icono}</span>
      <span className="header__nav-texto">{texto}</span>
    </Link>
  )

  return (
    <header className="header">
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
            <nav className="header__nav" aria-label="Secciones">
              {!user.isStaff && navLink('/chat',  '💬', 'Chat')}
              {!user.isStaff && navLink('/goals', '🎯', 'Metas')}
              {user.isStaff && navLink('/staff', '🩺', 'Panel Staff')}
              {user.isAdmin && navLink('/admin', '🛡️', 'Admin')}
              {user.isStaff && riskAlert.alto > 0 && (
                <Link
                  to={user.isAdmin ? '/admin' : '/staff'}
                  className="header__alerta-riesgo"
                  aria-label={`${riskAlert.alto} paciente(s) en riesgo alto`}
                  title={`${riskAlert.alto} paciente(s) en riesgo alto`}
                >
                  <span aria-hidden="true">🔴 {riskAlert.alto}</span>
                  <span className="header__nav-texto">en riesgo alto</span>
                </Link>
              )}
            </nav>
            {actions}
            <div className="header__user" style={{ paddingLeft: 16, borderLeft: '2px solid var(--border)', marginLeft: 8 }}>
              <div className="header__avatar">{initials(user.name)}</div>
              <span className="hide-on-mobile">{user.name.split(' ')[0]}</span>
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
