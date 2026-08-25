import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext.jsx'
import Icono from './Icono.jsx'

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
  const navLink = (to, nombreIcono, texto) => (
    <Link
      to={to}
      aria-label={texto}
      className="header__nav-link"
      style={{
        fontSize: '0.95rem',
        fontWeight: 500,
        color: location.pathname === to ? 'var(--teal-dark)' : 'var(--slate)',
        textDecoration: 'none',
        borderRadius: 'var(--radius-pill)',
        background: location.pathname === to ? 'var(--teal-pale)' : 'transparent',
        border: location.pathname === to ? '1px solid var(--teal-light)' : '1px solid transparent',
        transition: 'all 0.2s cubic-bezier(0.25, 1, 0.5, 1)'
      }}
    >
      <Icono nombre={nombreIcono} tamano={19} />
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
            width: 40,
            height: 40,
            borderRadius: '50%',
            objectFit: 'cover',
            border: '1px solid var(--line)',
            flexShrink: 0
          }}
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
        <div style={{
          display: 'none', width: 40, height: 40, borderRadius: '50%',
          background: 'var(--sage-pale)', border: '1px solid var(--line)',
          alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem',
          flexShrink: 0
        }}>

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
              {!user.isStaff && navLink('/inicio', 'inicio', 'Inicio')}
              {!user.isStaff && navLink('/chat',   'chat',   'Chat')}
              {!user.isStaff && navLink('/citas',  'citas',  'Citas')}
              {!user.isStaff && navLink('/goals',  'metas',  'Metas')}
              {user.isStaff && navLink('/staff', 'equipo', 'Panel Staff')}
              {user.isAdmin && navLink('/admin', 'alerta', 'Admin')}
              {user.isStaff && riskAlert.alto > 0 && (
                <Link
                  to={user.isAdmin ? '/admin' : '/staff'}
                  className="header__alerta-riesgo"
                  aria-label={`${riskAlert.alto} paciente(s) en riesgo alto`}
                  title={`${riskAlert.alto} paciente(s) en riesgo alto`}
                >
                  <span aria-hidden="true">{riskAlert.alto}</span>
                  <span className="header__nav-texto">en riesgo alto</span>
                </Link>
              )}
            </nav>
            {actions}
            <div className="header__user" style={{ paddingLeft: 16, borderLeft: '1px solid var(--line)', marginLeft: 8 }}>
              <div className="header__avatar">{initials(user.name)}</div>
              <span className="hide-on-mobile">{user.name.split(' ')[0]}</span>
            </div>
            <button
              className="btn btn--icon"
              onClick={logout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              style={{
                background: 'transparent', color: 'var(--slate)',
                border: '1px solid var(--line)', marginLeft: 4
              }}
            >
              <Icono nombre="salir" tamano={19} />
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
