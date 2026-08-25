import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext.jsx'
import Header from '../components/Header.jsx'
import Icono from '../components/Icono.jsx'
import { CATEGORIES } from '../constants.js'

/**
 * Panel de inicio de la persona usuaria.
 *
 * Es la primera pantalla tras iniciar sesión. Reúne en un vistazo las tres
 * cosas que le pertenecen —con quién hablar, cuándo es su cita y qué metas
 * tiene—, en vez de dejarla caer directamente en el chat sin contexto.
 */

const fmtFecha = d => new Date(d).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtHora  = d => new Date(d).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })

/** «Faltan 3 días» · «Es hoy» — más útil que una fecha suelta. */
function cuantoFalta(fecha) {
  const dias = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
  if (dias <= 0) return 'Es hoy'
  if (dias === 1) return 'Es mañana'
  return `Faltan ${dias} días`
}

function Tarjeta({ to, children, ...resto }) {
  return (
    <Link to={to} className="tarjeta-panel" {...resto}>
      {children}
    </Link>
  )
}

export default function PanelPage() {
  const { user } = useAuth()
  const [citas, setCitas] = useState([])
  const [metas, setMetas] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    Promise.all([
      axios.get('/api/auth/appointments').catch(() => ({ data: { appointments: [] } })),
      axios.get('/api/goals').catch(() => ({ data: { goals: [] } }))
    ]).then(([c, m]) => {
      if (!activo) return
      setCitas(c.data.appointments || [])
      setMetas(m.data.goals || [])
    }).finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  }, [])

  // El return condicional va DESPUÉS de todos los hooks (reglas de React).
  if (!user) return <Navigate to="/login" replace />

  const ahora = Date.now()
  const siguiente = citas
    .filter(c => c.status === 'programada' && new Date(c.date).getTime() >= ahora)
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0]

  const hechas = metas.filter(m => m.completed).length
  const pct = metas.length ? Math.round((hechas / metas.length) * 100) : 0
  const pendientes = metas.filter(m => !m.completed).slice(0, 5)
  const nombre = user.name?.split(' ')[0] || ''

  return (
    <div className="app-layout">
      <Header />
      <main className="page">
        <div className="page-head">
          <h1 className="page-head__title">Hola, {nombre}</h1>
          <p className="page-head__sub">Este es tu espacio. ¿Por dónde quieres empezar?</p>
        </div>

        <div className="panel-inicio">
          {/* ── Columna izquierda: chat y citas ── */}
          <div className="panel-inicio__col">
            <Tarjeta to="/chat" aria-label="Abrir el chat de acompañamiento">
              <div className="tarjeta-panel__icono"><Icono nombre="chat" tamano={24} /></div>
              <h2 className="tarjeta-panel__titulo">Chat Contigo</h2>
              <p className="tarjeta-panel__texto">
                Un espacio para hablar de lo que sientes, a cualquier hora del día.
              </p>
              <span className="tarjeta-panel__accion">Conversar →</span>
            </Tarjeta>

            <Tarjeta to="/citas" aria-label="Ver mis citas y el calendario">
              <div className="tarjeta-panel__icono"><Icono nombre="citas" tamano={24} /></div>
              <h2 className="tarjeta-panel__titulo">Citas y calendario</h2>

              {cargando ? (
                <p className="tarjeta-panel__texto">Cargando…</p>
              ) : siguiente ? (
                <>
                  <div className="tarjeta-panel__destacado">
                    <span className="tarjeta-panel__cuando">{cuantoFalta(siguiente.date)}</span>
                    <span style={{ textTransform: 'capitalize' }}>
                      {fmtFecha(siguiente.date)} · {fmtHora(siguiente.date)}
                    </span>
                    <span className="meta">
                      {siguiente.modality === 'online' ? 'En línea' : 'Presencial'} ·{' '}
                      con {siguiente.psychologistName}
                    </span>
                  </div>
                  <span className="tarjeta-panel__accion">Ver el calendario →</span>
                </>
              ) : (
                <>
                  <p className="tarjeta-panel__texto">
                    Aún no tienes citas agendadas. Cuando tu psicólogo/a agende una,
                    la verás aquí con su fecha y hora.
                  </p>
                  <span className="tarjeta-panel__accion">Ver el calendario →</span>
                </>
              )}
            </Tarjeta>
          </div>

          {/* ── Columna derecha: objetivos ── */}
          <section className="panel panel-inicio__metas">
            <div className="panel__head">
              <h2 className="panel__title"><Icono nombre="metas" tamano={20} /> Objetivos</h2>
              <Link to="/goals" className="btn btn--outline btn--sm">Ver todos</Link>
            </div>

            {cargando ? (
              <p className="meta">Cargando…</p>
            ) : metas.length === 0 ? (
              <div className="empty">
                <div className="empty__icon"><Icono nombre="metas" tamano={30} /></div>
                <p className="empty__title">Todavía no tienes objetivos</p>
                <p className="empty__text">
                  Puedes crearlos tú o aceptarlos cuando el chat te los sugiera.
                </p>
                <Link to="/goals" className="btn btn--primary btn--sm" style={{ marginTop: 12 }}>
                  Crear mi primer objetivo
                </Link>
              </div>
            ) : (
              <>
                <div className="progress" style={{ marginBottom: 6 }}>
                  <div className="progress__fill" style={{ width: `${pct}%` }} />
                </div>
                <p className="meta" style={{ marginBottom: 16 }}>
                  {hechas} de {metas.length} completados · {pct}%
                </p>

                <div className="list">
                  {pendientes.map(m => (
                    <div key={m._id} className="row-item">
                      <span
                        aria-hidden="true"
                        title={CATEGORIES.find(c => c.id === m.category)?.label}
                        style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: (CATEGORIES.find(c => c.id === m.category) || CATEGORIES[0]).color
                        }}
                      />
                      <div className="row-item__main">
                        <div className="row-item__titulo">{m.title}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {pendientes.length === 0 && (
                  <p className="meta">Completaste todos tus objetivos.</p>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
