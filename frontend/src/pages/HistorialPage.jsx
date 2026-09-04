import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext.jsx'
import Header from '../components/Header.jsx'
import Icono from '../components/Icono.jsx'
import ToastContainer from '../components/ToastContainer.jsx'
import { useToast } from '../hooks/useToast.js'
import { LEVEL_CONFIG } from '../constants.js'

/**
 * Mapa de calor estilo "contributions" de GitHub, con la intensidad
 * emocional detectada día a día. Es una vista personal — «este registro
 * es local a tu cuenta y no se comparte» — pensada para que la persona
 * usuaria note sus propios patrones, no para el equipo clínico.
 */

const RANGES = [
  { value: 30,  label: '30 días' },
  { value: 90,  label: '3 meses' },
  { value: 180, label: '6 meses' },
  { value: 365, label: '1 año' },
]

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
}

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Genera la grilla completa del rango (incluyendo días vacíos).
// Devuelve columnas semanales (cada columna = 7 días, dom-sab).
function buildGrid(days, cellsByDate) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(today.getDate() - (days - 1))

  // Alinear al domingo anterior
  const startDow = start.getDay()
  start.setDate(start.getDate() - startDow)

  const weeks = []
  const cur = new Date(start)
  while (cur <= today) {
    const week = []
    for (let i = 0; i < 7; i++) {
      const inRange = cur >= new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1))
        && cur <= today
      const key = dayKey(cur)
      const cell = cellsByDate.get(key)
      week.push({
        date: key,
        dow: cur.getDay(),
        month: cur.getMonth(),
        inRange,
        level: cell?.level || 'sin_datos',
        score: cell?.maxScore || 0,
        count: cell?.count || 0
      })
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

function MonthLabels({ weeks }) {
  // Pone el nombre del mes encima de la primera semana en que aparece.
  const labels = []
  let lastMonth = -1
  for (let w = 0; w < weeks.length; w++) {
    const firstInRange = weeks[w].find(c => c.inRange)
    if (!firstInRange) { labels.push(null); continue }
    if (firstInRange.month !== lastMonth) {
      lastMonth = firstInRange.month
      const name = new Date(2024, firstInRange.month, 1).toLocaleDateString('es', { month: 'short' })
      labels.push(name)
    } else {
      labels.push(null)
    }
  }
  return (
    <div className="historial__months">
      {labels.map((l, i) => <span key={i} className="historial__month-label">{l}</span>)}
    </div>
  )
}

export default function HistorialPage() {
  const { user } = useAuth()
  const { toasts, error: showError } = useToast()
  const [days, setDays]       = useState(90)
  const [data, setData]       = useState({ cells: [], summary: null })
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [dayEvents, setDayEvents] = useState([])

  useEffect(() => {
    let activo = true
    setLoading(true)
    const tzOffset = new Date().getTimezoneOffset()
    axios.get(`/api/auth/risk/heatmap?days=${days}&tzOffset=${tzOffset}`)
      .then(({ data }) => { if (activo) setData(data) })
      .catch(() => showError('No se pudo cargar tu historial.'))
      .finally(() => { if (activo) setLoading(false) })
    return () => { activo = false }
  }, [days])

  const cellsByDate = useMemo(() => {
    const m = new Map()
    for (const c of data.cells) m.set(c.date, c)
    return m
  }, [data.cells])

  const weeks = useMemo(() => buildGrid(days, cellsByDate), [days, cellsByDate])

  if (!user) return <Navigate to="/login" replace />

  const handleSelectDay = async (cell) => {
    if (!cell.inRange || cell.level === 'sin_datos') { setSelected(null); return }
    setSelected(cell)
    try {
      const tzOffset = new Date().getTimezoneOffset()
      const { data } = await axios.get(`/api/auth/risk/events?date=${cell.date}&tzOffset=${tzOffset}`)
      setDayEvents(data.events || [])
    } catch {
      setDayEvents([])
    }
  }

  const summary = data.summary || { totalEvents: 0, daysWithEvents: 0, bajo: 0, medio: 0, alto: 0 }

  return (
    <div className="app-layout">
      <Header />
      <ToastContainer toasts={toasts} />

      <main className="page">
        <div className="page-head">
          <h1 className="page-head__title">Tu historial emocional</h1>
          <p className="page-head__sub">
            Cada cuadro es un día. La intensidad refleja las señales que detectamos en tus
            mensajes del chat. Es solo para ti — este registro no se comparte con nadie.
          </p>
        </div>

        <div className="historial-range">
          {RANGES.map(r => (
            <button
              key={r.value}
              className={`historial-range__btn ${days === r.value ? 'is-active' : ''}`}
              onClick={() => setDays(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="historial-stats">
          <div className="historial-stat">
            <div className="historial-stat__value">{summary.daysWithEvents}</div>
            <div className="historial-stat__label">Días registrados</div>
          </div>
          {['bajo', 'medio', 'alto'].map(nivel => (
            <div className="historial-stat" key={nivel}>
              <div className="historial-stat__value">{summary[nivel]}</div>
              <div className="historial-stat__label">{LEVEL_CONFIG[nivel].label}</div>
              <div className="historial-stat__dot" style={{ background: LEVEL_CONFIG[nivel].color }} />
            </div>
          ))}
        </div>

        <div className="panel">
          {loading ? (
            <div className="historial-loading">
              <span className="spinner spinner--dark" style={{ width: 28, height: 28 }} />
            </div>
          ) : (
            <>
              <MonthLabels weeks={weeks} />
              <div className="historial-grid-wrap">
                <div className="historial-dow">
                  <span>D</span><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span>
                </div>
                <div className="historial-grid">
                  {weeks.map((week, wi) => (
                    <div key={wi} className="historial-week">
                      {week.map(cell => (
                        <button
                          key={cell.date}
                          className={`historial-cell ${selected?.date === cell.date ? 'is-selected' : ''}`}
                          style={{
                            background: cell.inRange ? LEVEL_CONFIG[cell.level].color : 'transparent',
                            opacity: cell.inRange ? (cell.level === 'sin_datos' ? 0.5 : 1) : 0.12,
                            cursor: cell.inRange && cell.level !== 'sin_datos' ? 'pointer' : 'default'
                          }}
                          onClick={() => handleSelectDay(cell)}
                          title={cell.inRange ? `${formatDate(cell.date)} — ${LEVEL_CONFIG[cell.level].label}${cell.count ? ` (${cell.count})` : ''}` : ''}
                          disabled={!cell.inRange}
                          aria-label={cell.inRange ? `${formatDate(cell.date)}, ${LEVEL_CONFIG[cell.level].label}` : ''}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="historial-legend">
                <span className="meta">Menos</span>
                {['sin_datos', 'bajo', 'medio', 'alto'].map(nivel => (
                  <span
                    key={nivel}
                    className="historial-cell historial-cell--legend"
                    style={{ background: LEVEL_CONFIG[nivel].color, opacity: nivel === 'sin_datos' ? 0.5 : 1 }}
                  />
                ))}
                <span className="meta">Más</span>
              </div>
            </>
          )}
        </div>

        {selected && selected.level !== 'sin_datos' && (
          <div className="panel historial-detalle">
            <div className="historial-detalle__head">
              <div>
                <div className="historial-detalle__fecha">{formatDate(selected.date)}</div>
                <div className="historial-detalle__nivel" style={{ color: LEVEL_CONFIG[selected.level].color }}>
                  Nivel {LEVEL_CONFIG[selected.level].label} · {selected.count} {selected.count === 1 ? 'señal' : 'señales'}
                </div>
              </div>
              <button className="btn btn--icon" onClick={() => setSelected(null)} aria-label="Cerrar detalle">
                <Icono nombre="cerrar" tamano={16} />
              </button>
            </div>
            {dayEvents.length === 0 ? (
              <p className="meta">Sin detalle disponible.</p>
            ) : (
              <div className="list">
                {dayEvents.map(e => (
                  <div key={e.id} className="row-item">
                    <span className="meta" style={{ flexShrink: 0 }}>
                      {new Date(e.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="row-item__main">
                      <div className="row-item__titulo">
                        {e.triggerWords.length > 0 ? e.triggerWords.join(' · ') : 'Sin términos detectados'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="meta" style={{ marginTop: 'var(--space-6)' }}>
          <Icono nombre="info" tamano={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />
          Si lo que ves aquí te preocupa, considera hablar con un profesional de salud mental.
        </p>
      </main>
    </div>
  )
}
