import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext.jsx'
import Header from '../components/Header.jsx'
import Icono from '../components/Icono.jsx'
import SemanaCitas, { inicioDeSemana, diasDeSemana, rangoDeSemana } from '../components/SemanaCitas.jsx'
import { APPT_STATUS, tinte } from '../constants.js'

const fmtFecha = d => new Date(d).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtHora  = d => new Date(d).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })

export default function CitasPage() {
  const { user } = useAuth()
  const [citas, setCitas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [semana, setSemana] = useState(() => inicioDeSemana(new Date()))

  useEffect(() => {
    axios.get('/api/auth/appointments')
      .then(({ data }) => setCitas(data.appointments))
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  // El return condicional va DESPUÉS de todos los hooks: las reglas de
  // React exigen que se llamen siempre en el mismo orden.
  if (!user) return <Navigate to="/login" replace />

  const ahora = Date.now()
  const proximas = citas
    .filter(c => c.status === 'programada' && new Date(c.date).getTime() >= ahora)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
  const siguiente = proximas[0]

  // Las citas ya vividas o canceladas. El historial no repite las que
  // están por venir: esas ya se ven en la rejilla de arriba.
  const pasadas = citas
    .filter(c => !(c.status === 'programada' && new Date(c.date).getTime() >= ahora))
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  // El aviso de la próxima cita solo aparece cuando esa cita NO cae en la
  // semana que se está viendo. Si ya está en la rejilla, repetirla arriba
  // hace parecer que la pantalla está duplicada.
  const finSemana = new Date(semana)
  finSemana.setDate(finSemana.getDate() + 7)
  const proximaEstaFuera = siguiente &&
    (new Date(siguiente.date) < semana || new Date(siguiente.date) >= finSemana)

  const moverSemana = (delta) => {
    const d = new Date(semana)
    d.setDate(d.getDate() + delta * 7)
    setSemana(d)
  }

  const irALaProxima = () => setSemana(inicioDeSemana(new Date(siguiente.date)))

  return (
    <div className="app-layout">
      <Header />
      <main className="page">
        <div className="page-head">
          <h1 className="page-head__title">Mis citas</h1>
          <p className="page-head__sub">
            Las agenda tu psicólogo/a. Si necesitas cambiar una, escríbele con anticipación.
          </p>
        </div>

        {proximaEstaFuera && (
          <div style={{
            position: 'relative', overflow: 'hidden',
            background: 'var(--teal)', borderRadius: 'var(--radius-xl)',
            padding: 'clamp(22px, 3vw, 32px)', marginBottom: 20,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: 16
          }}>
            <div style={{
              position: 'absolute', right: -100, top: -120, width: 320, height: 320, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(102,178,166,0.24) 0%, rgba(102,178,166,0) 70%)', pointerEvents: 'none'
            }} />
            <div style={{ position: 'relative' }}>
              <div style={{
                fontSize: '0.68rem', fontWeight: 700, color: 'var(--dorado)',
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10
              }}>
                Tu próxima cita no está en esta semana
              </div>
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(1.3rem, 2.4vw, 1.7rem)',
                color: 'var(--sobre-acento)', textTransform: 'capitalize', marginBottom: 6
              }}>
                {fmtFecha(siguiente.date)} · {fmtHora(siguiente.date)}
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--muted-on-dark)' }}>
                {siguiente.modality === 'online' ? 'En línea' : 'Presencial'} ·{' '}
                {siguiente.durationMin} min · con {siguiente.psychologistName}
              </div>
            </div>
            <button className="btn btn--sm" style={{ position: 'relative', background: 'var(--white)', color: 'var(--teal)', border: 'none' }} onClick={irALaProxima}>
              Ir a esa semana →
            </button>
          </div>
        )}

        <section className="panel">
          <div className="panel__head">
            <h2 className="panel__title">Semana {rangoDeSemana(diasDeSemana(semana))}</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn--icon" aria-label="Semana anterior" title="Semana anterior" onClick={() => moverSemana(-1)}>
                <Icono nombre="flecha-izq" tamano={17} />
              </button>
              <button className="btn btn--outline btn--sm" onClick={() => setSemana(inicioDeSemana(new Date()))}>Hoy</button>
              <button className="btn btn--icon" aria-label="Semana siguiente" title="Semana siguiente" onClick={() => moverSemana(1)}>
                <Icono nombre="flecha" tamano={17} />
              </button>
            </div>
          </div>

          <SemanaCitas
            citas={citas}
            inicio={semana}
            nombreDe={c => c.psychologistName}
          />
        </section>

        {/* Estado vacío: antes la sección simplemente no se mostraba, así
            que quien no tuviera ninguna cita nunca sabía que esto existía. */}
        {!cargando && citas.length === 0 && (
          <div className="empty" style={{ marginTop: 20 }}>
            <div className="empty__icon"><Icono nombre="citas" tamano={30} /></div>
            <p className="empty__title">Aún no tienes citas agendadas</p>
            <p className="empty__text">
              Cuando tu psicólogo/a agende una, aparecerá aquí con su fecha y hora.
            </p>
          </div>
        )}

        {pasadas.length > 0 && (
          <section className="panel" style={{ marginTop: 20 }}>
            <div className="panel__head">
              <h2 className="panel__title">Citas anteriores</h2>
              <span className="panel__hint">{pasadas.length} en total</span>
            </div>
            <div className="list">
              {pasadas.map(c => {
                const st = APPT_STATUS[c.status] || APPT_STATUS.programada
                return (
                  <div key={c._id} className="row-item">
                    <div className="row-item__main">
                      <div className="row-item__titulo" style={{ textTransform: 'capitalize' }}>
                        {fmtFecha(c.date)} · {fmtHora(c.date)}
                      </div>
                      <div className="meta">
                        {c.modality === 'online' ? 'En línea' : 'Presencial'} ·{' '}
                        {c.durationMin} min · con {c.psychologistName}
                      </div>
                    </div>
                    <span className="chip" style={{ background: st.bg, color: st.color, borderColor: tinte(st.color, 25) }}>
                      {st.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
