import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext.jsx'
import Header from '../components/Header.jsx'
import Icon from '../components/Icon.jsx'
import ToastContainer from '../components/ToastContainer.jsx'
import { useToast } from '../hooks/useToast.js'

// Mapa de calor estilo "contributions" tipo GitHub.
// Muestra los últimos N días con intensidad por nivel de riesgo detectado.
// Pensado como vista personal del usuario — su línea de tiempo emocional.

const RANGES = [
  { value: 30,  label: '30 días' },
  { value: 90,  label: '3 meses' },
  { value: 180, label: '6 meses' },
  { value: 365, label: '1 año' },
]

const LEVEL_COLORS = {
  none: '#eef2f3',
  L1:   '#fce8a8',
  L2:   '#f6a96b',
  L3:   '#d6604a'
}

const LEVEL_LABELS = {
  none: 'Sin señales',
  L1:   'Atención',
  L2:   'Alto',
  L3:   'Crítico'
}

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
        level: cell?.level || 'none',
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
    <div className="heatmap__months">
      {labels.map((l, i) => <span key={i} className="heatmap__month-label">{l}</span>)}
    </div>
  )
}

export default function HeatmapPage() {
  const { user } = useAuth()
  const { toasts, error: showError } = useToast()
  const [days, setDays]       = useState(90)
  const [data, setData]       = useState({ cells: [], summary: null })
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [dayEvents, setDayEvents] = useState([])

  if (!user) return <Navigate to="/login" replace />

  useEffect(() => {
    setLoading(true)
    axios.get(`/api/risk/heatmap?days=${days}`)
      .then(({ data }) => setData(data))
      .catch(() => showError('No se pudo cargar el mapa.'))
      .finally(() => setLoading(false))
  }, [days])

  const cellsByDate = useMemo(() => {
    const m = new Map()
    for (const c of data.cells) m.set(c.date, c)
    return m
  }, [data.cells])

  const weeks = useMemo(() => buildGrid(days, cellsByDate), [days, cellsByDate])

  const handleSelectDay = async (cell) => {
    if (!cell.inRange || cell.level === 'none') { setSelected(null); return }
    setSelected(cell)
    try {
      const since = cell.date
      const { data } = await axios.get(`/api/risk/events?since=${since}`)
      const sameDay = data.events.filter(e => (e.createdAt || '').startsWith(cell.date))
      setDayEvents(sameDay)
    } catch {
      setDayEvents([])
    }
  }

  const summary = data.summary || { totalEvents: 0, daysWithEvents: 0, L1: 0, L2: 0, L3: 0, lastDate: null }

  return (
    <div className="app-layout">
      <Header />
      <ToastContainer toasts={toasts} />

      <main className="heatmap-page">
        <div className="heatmap-header">
          <div>
            <h1 className="heatmap-title">Tu línea de tiempo emocional</h1>
            <p className="heatmap-subtitle">
              Cada cuadro es un día. La intensidad refleja la fuerza emocional
              detectada en tus mensajes. Es solo para ti.
            </p>
          </div>
          <div className="heatmap-range">
            {RANGES.map(r => (
              <button
                key={r.value}
                className={`heatmap-range__btn ${days === r.value ? 'is-active' : ''}`}
                onClick={() => setDays(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="heatmap-stats">
          <div className="heatmap-stat">
            <div className="heatmap-stat__value">{summary.daysWithEvents}</div>
            <div className="heatmap-stat__label">Días registrados</div>
          </div>
          <div className="heatmap-stat">
            <div className="heatmap-stat__value">{summary.L1}</div>
            <div className="heatmap-stat__label">Atención</div>
            <div className="heatmap-stat__dot" style={{ background: LEVEL_COLORS.L1 }} />
          </div>
          <div className="heatmap-stat">
            <div className="heatmap-stat__value">{summary.L2}</div>
            <div className="heatmap-stat__label">Alto</div>
            <div className="heatmap-stat__dot" style={{ background: LEVEL_COLORS.L2 }} />
          </div>
          <div className="heatmap-stat">
            <div className="heatmap-stat__value">{summary.L3}</div>
            <div className="heatmap-stat__label">Crítico</div>
            <div className="heatmap-stat__dot" style={{ background: LEVEL_COLORS.L3 }} />
          </div>
        </div>

        {/* Grid */}
        <div className="heatmap-card">
          {loading ? (
            <div className="heatmap-loading">
              <span className="spinner spinner--dark" style={{ width: 28, height: 28 }} />
            </div>
          ) : (
            <>
              <MonthLabels weeks={weeks} />
              <div className="heatmap-grid-wrap">
                <div className="heatmap-dow">
                  <span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span>
                </div>
                <div className="heatmap-grid">
                  {weeks.map((week, wi) => (
                    <div key={wi} className="heatmap-week">
                      {week.map(cell => (
                        <button
                          key={cell.date}
                          className={`heatmap-cell ${selected?.date === cell.date ? 'is-selected' : ''}`}
                          style={{
                            background: cell.inRange ? LEVEL_COLORS[cell.level] : 'transparent',
                            opacity: cell.inRange ? 1 : 0.15,
                            cursor: cell.inRange && cell.level !== 'none' ? 'pointer' : 'default'
                          }}
                          onClick={() => handleSelectDay(cell)}
                          title={cell.inRange ? `${formatDate(cell.date)} — ${LEVEL_LABELS[cell.level]}${cell.count ? ` (${cell.count})` : ''}` : ''}
                          disabled={!cell.inRange}
                          aria-label={cell.inRange ? `${formatDate(cell.date)}, ${LEVEL_LABELS[cell.level]}` : ''}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="heatmap-legend">
                <span className="heatmap-legend__label">Menos</span>
                <span className="heatmap-cell heatmap-cell--legend" style={{ background: LEVEL_COLORS.none }} />
                <span className="heatmap-cell heatmap-cell--legend" style={{ background: LEVEL_COLORS.L1 }} />
                <span className="heatmap-cell heatmap-cell--legend" style={{ background: LEVEL_COLORS.L2 }} />
                <span className="heatmap-cell heatmap-cell--legend" style={{ background: LEVEL_COLORS.L3 }} />
                <span className="heatmap-legend__label">Más</span>
              </div>
            </>
          )}
        </div>

        {/* Detalle del día seleccionado */}
        {selected && selected.level !== 'none' && (
          <div className="heatmap-detail">
            <div className="heatmap-detail__head">
              <div>
                <div className="heatmap-detail__date">{formatDate(selected.date)}</div>
                <div className="heatmap-detail__level" style={{ color: LEVEL_COLORS[selected.level] }}>
                  Nivel {LEVEL_LABELS[selected.level]} · {selected.count} {selected.count === 1 ? 'señal' : 'señales'}
                </div>
              </div>
              <button className="btn btn--ghost btn--sm" onClick={() => setSelected(null)}>
                <Icon name="close" size={16} />
              </button>
            </div>
            {dayEvents.length === 0 ? (
              <p className="heatmap-detail__empty">Sin detalle disponible.</p>
            ) : (
              <ul className="heatmap-detail__list">
                {dayEvents.map(e => (
                  <li key={e.id} className="heatmap-detail__item">
                    <span className="heatmap-detail__time">
                      {new Date(e.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="heatmap-detail__terms">
                      {e.terms.length > 0 ? e.terms.join(' · ') : 'Sin términos'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <p className="heatmap-disclaimer">
          <Icon name="info" size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />
          Este registro es local a tu cuenta y no se comparte. Si lo que ves
          te preocupa, considera hablar con un profesional de salud mental.
        </p>
      </main>
    </div>
  )
}
