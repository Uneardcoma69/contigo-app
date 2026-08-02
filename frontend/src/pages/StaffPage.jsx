import { useState, useEffect, useCallback, useMemo } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext.jsx'
import Header from '../components/Header.jsx'
import ToastContainer from '../components/ToastContainer.jsx'
import { useToast } from '../hooks/useToast.js'

const LEVEL_CONFIG = {
  alto:      { label: 'Alto',      emoji: '🔴', color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  medio:     { label: 'Medio',     emoji: '🟡', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  bajo:      { label: 'Bajo',      emoji: '🟢', color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0' },
  sin_datos: { label: 'Sin datos', emoji: '⚪', color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0' },
}

const MEDICAL_STATUS = {
  validada:  { label: 'Validada',  emoji: '✅', color: '#16a34a', bg: '#f0fdf4' },
  pendiente: { label: 'Pendiente', emoji: '⏳', color: '#f59e0b', bg: '#fffbeb' },
  rechazada: { label: 'Rechazada', emoji: '❌', color: '#ef4444', bg: '#fef2f2' },
  sin_ficha: { label: 'Sin ficha', emoji: '📄', color: '#94a3b8', bg: '#f8fafc' },
}

const ROLE_LABEL = { psychologist: 'Psicólogo/a', monitor: 'Monitor/a', admin: 'Admin', user: 'Paciente' }

function RiskBadge({ level }) {
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.sin_datos
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 12px', borderRadius: 999,
      background: cfg.bg, color: cfg.color, border: `1.5px solid ${cfg.border}`,
      fontWeight: 800, fontSize: '0.78rem', whiteSpace: 'nowrap'
    }}>
      {cfg.emoji} {cfg.label}
    </span>
  )
}

function SectionCard({ title, children, right }) {
  return (
    <div style={{
      background: 'var(--white)', borderRadius: 'var(--radius-lg)',
      padding: 24, boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)',
      marginBottom: 24
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--navy)' }}>{title}</h2>
        {right}
      </div>
      {children}
    </div>
  )
}

/* ═══════════ Detalle de paciente (expediente) ═══════════ */
function PatientDetail({ patientId, onClose, notify }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [tab, setTab] = useState('chat')

  const load = useCallback(() => {
    axios.get(`/api/staff/patients/${patientId}`)
      .then(({ data: d }) => setData(d))
      .catch(err => notify.error(err?.response?.data?.message || 'Error al cargar el expediente.'))
      .finally(() => setLoading(false))
  }, [patientId, notify])

  useEffect(() => { load() }, [load])

  const addNote = async () => {
    if (!noteText.trim()) return
    setSavingNote(true)
    try {
      await axios.post(`/api/staff/patients/${patientId}/notes`, { text: noteText })
      setNoteText('')
      notify.success('Nota guardada.')
      load()
    } catch (err) {
      notify.error(err?.response?.data?.message || 'Error al guardar la nota.')
    } finally {
      setSavingNote(false)
    }
  }

  const validateMedical = async (status) => {
    try {
      await axios.put(`/api/staff/patients/${patientId}/medical/validate`, { status })
      notify.success(`Ficha marcada como ${status}.`)
      load()
    } catch (err) {
      notify.error(err?.response?.data?.message || 'Error al validar la ficha.')
    }
  }

  const tabBtn = (id, label) => (
    <button
      className={`btn btn--sm ${tab === id ? 'btn--primary' : 'btn--ghost'}`}
      onClick={() => setTab(id)}
      style={{ fontSize: '0.82rem' }}
    >{label}</button>
  )

  return (
    <div className="admin-modal-overlay" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(26,43,60,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-color)', borderRadius: 'var(--radius-lg)',
        width: 'min(860px, 100%)', maxHeight: '90vh', overflowY: 'auto', padding: 28
      }}>
        {loading || !data ? (
          <div style={{ textAlign: 'center', padding: 60 }}>Cargando expediente...</div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, color: 'var(--navy)' }}>
                  {data.patient.name}
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--slate)' }}>{data.patient.email}</p>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <RiskBadge level={data.risk.level} />
                <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--slate)' }}>✕</button>
              </div>
            </div>

            {/* Progreso */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px', background: 'var(--white)', borderRadius: 14, padding: '12px 16px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate)' }}>PROGRESO DE METAS</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--navy)' }}>
                  {data.progress.completedGoals}/{data.progress.totalGoals} <span style={{ fontSize: '0.9rem', color: 'var(--teal-dark)' }}>({data.progress.pct}%)</span>
                </div>
                <div style={{ height: 8, background: 'var(--sage-pale)', borderRadius: 999, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${data.progress.pct}%`, background: 'linear-gradient(90deg, var(--teal), var(--sage))', borderRadius: 999 }} />
                </div>
              </div>
              <div style={{ flex: '1 1 160px', background: 'var(--white)', borderRadius: 14, padding: '12px 16px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate)' }}>ALERTAS DE RIESGO</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: LEVEL_CONFIG[data.risk.level]?.color }}>
                  {data.risk.alerts?.length || 0}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>score máx: {data.risk.score}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {tabBtn('chat', '💬 Chat')}
              {tabBtn('goals', '🎯 Metas')}
              {tabBtn('notes', '📝 Notas')}
              {tabBtn('medical', '🏥 Ficha médica')}
              {tabBtn('alerts', '⚠️ Alertas')}
            </div>

            {/* ── Chat ── */}
            {tab === 'chat' && (
              <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.chat.length === 0 && <p style={{ color: 'var(--slate)', textAlign: 'center', padding: 24 }}>Sin mensajes todavía.</p>}
                {data.chat.map((m, i) => (
                  <div key={i} style={{
                    padding: '10px 14px', borderRadius: 12, fontSize: '0.88rem',
                    background: m.role === 'user' ? 'var(--teal-pale)' : 'var(--white)',
                    border: '1px solid var(--border)',
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%'
                  }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: m.role === 'user' ? 'var(--teal-dark)' : 'var(--slate)', marginBottom: 2 }}>
                      {m.role === 'user' ? '👤 Paciente' : '🤖 Contigo'} · {new Date(m.timestamp).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {m.content}
                  </div>
                ))}
              </div>
            )}

            {/* ── Metas ── */}
            {tab === 'goals' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.goals.length === 0 && <p style={{ color: 'var(--slate)', textAlign: 'center', padding: 24 }}>El paciente aún no tiene metas.</p>}
                {data.goals.map(g => (
                  <div key={g._id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                    background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12
                  }}>
                    <span style={{ fontSize: '1.1rem' }}>{g.completed ? '✅' : '⭕'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', textDecoration: g.completed ? 'line-through' : 'none', color: g.completed ? 'var(--slate)' : 'var(--navy)' }}>{g.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>{g.category} · creada {new Date(g.createdAt).toLocaleDateString('es')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Notas ── */}
            {tab === 'notes' && (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <input
                    className="form-input"
                    style={{ padding: '10px 16px', fontSize: '0.9rem' }}
                    placeholder="Escribe una nota clínica o de seguimiento..."
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addNote()}
                  />
                  <button className="btn btn--primary btn--sm" onClick={addNote} disabled={savingNote || !noteText.trim()}>
                    Guardar
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                  {data.notes.length === 0 && <p style={{ color: 'var(--slate)', textAlign: 'center', padding: 16 }}>Sin notas todavía.</p>}
                  {data.notes.slice().reverse().map(n => (
                    <div key={n._id} style={{ padding: '10px 14px', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, fontSize: '0.88rem' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--teal-dark)', marginBottom: 2 }}>
                        {n.authorName} · {new Date(n.createdAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {n.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Ficha médica ── */}
            {tab === 'medical' && (
              <div>
                {!data.medicalRecord ? (
                  <p style={{ color: 'var(--slate)', textAlign: 'center', padding: 24 }}>
                    📄 El paciente aún no ha registrado su información médica.
                  </p>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      {(() => {
                        const st = MEDICAL_STATUS[data.medicalRecord.validationStatus] || MEDICAL_STATUS.pendiente
                        return (
                          <span style={{ padding: '4px 12px', borderRadius: 999, background: st.bg, color: st.color, fontWeight: 800, fontSize: '0.8rem' }}>
                            {st.emoji} {st.label}
                          </span>
                        )
                      })()}
                      {data.medicalRecord.validatedByName && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--slate)' }}>
                          por {data.medicalRecord.validatedByName} · {new Date(data.medicalRecord.validatedAt).toLocaleString('es')}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 16 }}>
                      {Object.entries(data.medicalRecord.info).map(([k, v]) => (
                        <div key={k} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k}</div>
                          <div style={{ fontSize: '0.9rem', color: 'var(--navy)', fontWeight: 600 }}>{v || '—'}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn--secondary btn--sm" onClick={() => validateMedical('validada')}>✅ Validar</button>
                      <button className="btn btn--outline btn--sm" onClick={() => validateMedical('rechazada')} style={{ color: '#b91c1c' }}>❌ Rechazar</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Alertas ── */}
            {tab === 'alerts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
                {(!data.risk.alerts || data.risk.alerts.length === 0) && <p style={{ color: 'var(--slate)', textAlign: 'center', padding: 24 }}>Sin alertas registradas. 🌿</p>}
                {data.risk.alerts?.slice().reverse().map((a, i) => (
                  <div key={i} style={{
                    padding: '10px 14px', borderRadius: 12,
                    background: LEVEL_CONFIG[a.level]?.bg, border: `1px solid ${LEVEL_CONFIG[a.level]?.border}`,
                    fontSize: '0.85rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <RiskBadge level={a.level} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>{new Date(a.timestamp).toLocaleString('es')}</span>
                    </div>
                    "{a.message}"
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ═══════════ Calendario semanal ═══════════ */
function startOfWeek(d) {
  const date = new Date(d)
  const day = (date.getDay() + 6) % 7   // lunes = 0
  date.setDate(date.getDate() - day)
  date.setHours(0, 0, 0, 0)
  return date
}

const APPT_STATUS = {
  programada: { label: 'Programada', color: 'var(--teal-dark)', bg: 'var(--teal-pale)' },
  completada: { label: 'Completada', color: '#16a34a', bg: '#f0fdf4' },
  cancelada:  { label: 'Cancelada',  color: '#94a3b8', bg: '#f8fafc' },
}

function CalendarTab({ patients, isAdmin, notify }) {
  const [appointments, setAppointments] = useState([])
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [showForm, setShowForm] = useState(false)
  const [team, setTeam] = useState([])
  const [form, setForm] = useState({ patientId: '', date: '', time: '09:00', durationMin: 50, modality: 'online', notes: '', psychologistId: '' })

  const load = useCallback(() => {
    axios.get('/api/staff/appointments')
      .then(({ data }) => setAppointments(data.appointments))
      .catch(() => notify.error('Error al cargar las citas.'))
  }, [notify])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (isAdmin) axios.get('/api/staff/team').then(({ data }) => setTeam(data.staff)).catch(() => {})
  }, [isAdmin])

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  const apptsOf = (day) => appointments
    .filter(a => {
      const ad = new Date(a.date)
      return ad.getFullYear() === day.getFullYear() && ad.getMonth() === day.getMonth() && ad.getDate() === day.getDate()
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  const createAppt = async (e) => {
    e.preventDefault()
    if (!form.patientId || !form.date || !form.time) {
      notify.error('Paciente, fecha y hora son requeridos.')
      return
    }
    try {
      await axios.post('/api/staff/appointments', {
        patientId: form.patientId,
        date: `${form.date}T${form.time}:00`,
        durationMin: Number(form.durationMin),
        modality: form.modality,
        notes: form.notes,
        psychologistId: isAdmin && form.psychologistId ? form.psychologistId : undefined
      })
      notify.success('Cita agendada. 📅')
      setShowForm(false)
      setForm(f => ({ ...f, notes: '' }))
      load()
    } catch (err) {
      notify.error(err?.response?.data?.message || 'Error al agendar la cita.')
    }
  }

  const setStatus = async (appt, status) => {
    try {
      await axios.put(`/api/staff/appointments/${appt._id}`, { status })
      load()
    } catch (err) {
      notify.error(err?.response?.data?.message || 'Error al actualizar la cita.')
    }
  }

  const removeAppt = async (appt) => {
    try {
      await axios.delete(`/api/staff/appointments/${appt._id}`)
      notify.info('Cita eliminada.')
      load()
    } catch (err) {
      notify.error(err?.response?.data?.message || 'Error al eliminar la cita.')
    }
  }

  const moveWeek = (delta) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + delta * 7)
    setWeekStart(d)
  }

  const fmtRange = `${days[0].toLocaleDateString('es', { day: 'numeric', month: 'short' })} — ${days[6].toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}`
  const today = new Date()

  return (
    <SectionCard
      title={`📅 Semana ${fmtRange}`}
      right={
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--outline btn--sm" onClick={() => moveWeek(-1)}>← Anterior</button>
          <button className="btn btn--outline btn--sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>Hoy</button>
          <button className="btn btn--outline btn--sm" onClick={() => moveWeek(1)}>Siguiente →</button>
          <button className="btn btn--primary btn--sm" onClick={() => setShowForm(s => !s)}>{showForm ? 'Cerrar' : '+ Nueva cita'}</button>
        </div>
      }
    >
      {showForm && (
        <form onSubmit={createAppt} style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10,
          background: 'var(--sage-pale)', padding: 16, borderRadius: 14, marginBottom: 18, alignItems: 'end'
        }}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Paciente</label>
            <select className="form-input" style={{ padding: '10px 14px' }} value={form.patientId} onChange={e => setForm(f => ({ ...f, patientId: e.target.value }))}>
              <option value="">Selecciona...</option>
              {patients.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          {isAdmin && (
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Psicólogo/a</label>
              <select className="form-input" style={{ padding: '10px 14px' }} value={form.psychologistId} onChange={e => setForm(f => ({ ...f, psychologistId: e.target.value }))}>
                <option value="">Yo mismo/a</option>
                {team.map(t => <option key={t._id} value={t._id}>{t.name} ({ROLE_LABEL[t.role]})</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Fecha</label>
            <input type="date" className="form-input" style={{ padding: '10px 14px' }} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Hora</label>
            <input type="time" className="form-input" style={{ padding: '10px 14px' }} value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Duración (min)</label>
            <input type="number" min="20" max="180" step="5" className="form-input" style={{ padding: '10px 14px' }} value={form.durationMin} onChange={e => setForm(f => ({ ...f, durationMin: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Modalidad</label>
            <select className="form-input" style={{ padding: '10px 14px' }} value={form.modality} onChange={e => setForm(f => ({ ...f, modality: e.target.value }))}>
              <option value="online">En línea</option>
              <option value="presencial">Presencial</option>
            </select>
          </div>
          <button type="submit" className="btn btn--primary btn--sm">Agendar</button>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, overflowX: 'auto', minWidth: 0 }}>
        {days.map((day, i) => {
          const isToday = day.toDateString() === today.toDateString()
          const dayAppts = apptsOf(day)
          return (
            <div key={i} style={{
              background: isToday ? 'var(--teal-pale)' : 'var(--cream)',
              border: `1px solid ${isToday ? 'var(--teal-light)' : 'var(--border)'}`,
              borderRadius: 12, padding: 8, minHeight: 130
            }}>
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--slate)', textTransform: 'uppercase' }}>
                  {day.toLocaleDateString('es', { weekday: 'short' })}
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 900, color: isToday ? 'var(--teal-dark)' : 'var(--navy)' }}>
                  {day.getDate()}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {dayAppts.map(a => {
                  const st = APPT_STATUS[a.status] || APPT_STATUS.programada
                  const time = new Date(a.date).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
                  return (
                    <div key={a._id} style={{
                      background: st.bg, border: `1px solid ${st.color}30`,
                      borderLeft: `3px solid ${st.color}`,
                      borderRadius: 8, padding: '6px 8px', fontSize: '0.72rem'
                    }}>
                      <div style={{ fontWeight: 800, color: st.color }}>{time} · {a.durationMin}min</div>
                      <div style={{ fontWeight: 700, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.patientName}</div>
                      <div style={{ color: 'var(--slate)' }}>{a.modality === 'online' ? '💻' : '🏢'} {st.label}</div>
                      {a.status === 'programada' && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                          <button title="Completada" onClick={() => setStatus(a, 'completada')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: '0.8rem' }}>✅</button>
                          <button title="Cancelar" onClick={() => setStatus(a, 'cancelada')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: '0.8rem' }}>🚫</button>
                          <button title="Eliminar" onClick={() => removeAppt(a)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: '0.8rem' }}>🗑️</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}

/* ═══════════ Reportes ═══════════ */
function ReportsTab({ notify }) {
  const [report, setReport] = useState(null)

  const load = useCallback(() => {
    axios.get('/api/staff/reports')
      .then(({ data }) => setReport(data))
      .catch(() => notify.error('Error al generar el reporte.'))
  }, [notify])

  useEffect(() => { load() }, [load])

  if (!report) return <SectionCard title="📊 Reportes"><p style={{ color: 'var(--slate)' }}>Generando reporte...</p></SectionCard>

  const s = report.summary
  const statBox = (label, value, sub, color = 'var(--navy)') => (
    <div style={{ flex: '1 1 150px', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 18px' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 900, color }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>{sub}</div>}
    </div>
  )

  return (
    <SectionCard
      title={`📊 Reporte ${report.scope === 'global' ? 'global' : 'de mis pacientes'}`}
      right={<button className="btn btn--outline btn--sm" onClick={load}>🔄 Regenerar</button>}
    >
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {statBox('Pacientes', s.patients)}
        {statBox('Riesgo alto', s.riskLevels.alto, `${s.riskLevels.medio} medio · ${s.riskLevels.bajo} bajo`, '#ef4444')}
        {statBox('Alertas totales', s.totalAlerts, null, '#f59e0b')}
        {statBox('Metas cumplidas', `${s.goals.pct}%`, `${s.goals.completed}/${s.goals.total}`, 'var(--teal-dark)')}
        {statBox('Fichas validadas', s.medical.validadas, `${s.medical.pendientes} pendientes · ${s.medical.sinFicha} sin ficha`, '#16a34a')}
        {statBox('Citas próximas', s.appointments.proximas, `${s.appointments.completadas} completadas · ${s.appointments.canceladas} canceladas`)}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--slate)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
              <th style={{ padding: '8px 10px' }}>Paciente</th>
              <th style={{ padding: '8px 10px' }}>Riesgo</th>
              <th style={{ padding: '8px 10px' }}>Alertas</th>
              <th style={{ padding: '8px 10px' }}>Metas</th>
              <th style={{ padding: '8px 10px' }}>Ficha médica</th>
              <th style={{ padding: '8px 10px' }}>Notas</th>
            </tr>
          </thead>
          <tbody>
            {report.patients.map(p => {
              const med = MEDICAL_STATUS[p.medical] || MEDICAL_STATUS.sin_ficha
              return (
                <tr key={p._id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px', fontWeight: 700 }}>{p.name}</td>
                  <td style={{ padding: '10px' }}><RiskBadge level={p.level} /></td>
                  <td style={{ padding: '10px', fontWeight: 700 }}>{p.alerts}</td>
                  <td style={{ padding: '10px' }}>{p.goalsCompleted}/{p.goals} ({p.goalsPct}%)</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ color: med.color, fontWeight: 700 }}>{med.emoji} {med.label}</span>
                  </td>
                  <td style={{ padding: '10px' }}>{p.notes}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {report.patients.length === 0 && <p style={{ color: 'var(--slate)', textAlign: 'center', padding: 20 }}>Sin pacientes para reportar.</p>}
      </div>
    </SectionCard>
  )
}

/* ═══════════ Equipo (solo admin) ═══════════ */
function TeamTab({ notify, onChanged }) {
  const [staff, setStaff] = useState([])
  const [patients, setPatients] = useState([])
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'psychologist' })
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => {
    axios.get('/api/admin/staff').then(({ data }) => setStaff(data.staff)).catch(() => {})
    axios.get('/api/admin/dashboard').then(({ data }) => setPatients(data.users)).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  const createStaff = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      await axios.post('/api/admin/staff', form)
      notify.success(`Cuenta de ${ROLE_LABEL[form.role]} creada. 🎉`)
      setForm({ name: '', email: '', password: '', role: 'psychologist' })
      load()
    } catch (err) {
      notify.error(err?.response?.data?.message || 'Error al crear la cuenta.')
    } finally {
      setCreating(false)
    }
  }

  const assign = async (patientId, staffId) => {
    try {
      await axios.put(`/api/admin/patients/${patientId}/assign`, { staffId: staffId || null })
      notify.success('Asignación actualizada.')
      load()
      onChanged?.()
    } catch (err) {
      notify.error(err?.response?.data?.message || 'Error al asignar.')
    }
  }

  return (
    <>
      <SectionCard title="👥 Crear cuenta de staff">
        <form onSubmit={createStaff} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Nombre</label>
            <input className="form-input" style={{ padding: '10px 14px' }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Correo</label>
            <input type="email" className="form-input" style={{ padding: '10px 14px' }} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Contraseña</label>
            <input type="password" className="form-input" style={{ padding: '10px 14px' }} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={6} />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Rol</label>
            <select className="form-input" style={{ padding: '10px 14px' }} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="psychologist">Psicólogo/a</option>
              <option value="monitor">Monitor/a</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" className="btn btn--primary btn--sm" disabled={creating}>Crear cuenta</button>
        </form>

        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {staff.map(m => (
            <div key={m._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--cream)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--teal), var(--sage))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '0.85rem'
              }}>
                {m.name[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{m.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>{m.email}</div>
              </div>
              <span style={{ padding: '3px 10px', borderRadius: 999, background: 'var(--teal-pale)', color: 'var(--teal-dark)', fontWeight: 800, fontSize: '0.75rem' }}>
                {ROLE_LABEL[m.role]}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="🔗 Asignar pacientes">
        {patients.length === 0 ? (
          <p style={{ color: 'var(--slate)', textAlign: 'center', padding: 16 }}>Sin pacientes registrados todavía.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {patients.map(p => (
              <div key={p._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--cream)', borderRadius: 12, border: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 180px' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{p.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>{p.email}</div>
                </div>
                <RiskBadge level={p.risk.level} />
                <select
                  className="form-input"
                  style={{ padding: '8px 12px', width: 'auto', minWidth: 180, fontSize: '0.85rem' }}
                  value={p.assignedPsychologistId || ''}
                  onChange={e => assign(p._id, e.target.value)}
                >
                  <option value="">— Sin asignar —</option>
                  {staff.filter(m => m.role !== 'admin').map(m => (
                    <option key={m._id} value={m._id}>{m.name} ({ROLE_LABEL[m.role]})</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  )
}

/* ═══════════ Página principal ═══════════ */
export default function StaffPage() {
  const { user } = useAuth()
  const { toasts, success, error, info } = useToast()
  const notify = useMemo(() => ({ success, error, info }), [success, error, info])

  const [tab, setTab] = useState('patients')
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPatient, setSelectedPatient] = useState(null)

  const loadPatients = useCallback(() => {
    axios.get('/api/staff/patients')
      .then(({ data }) => setPatients(data.patients))
      .catch(err => error(err?.response?.data?.message || 'Error al cargar pacientes.'))
      .finally(() => setLoading(false))
  }, [error])

  useEffect(() => { loadPatients() }, [loadPatients])

  const tabBtn = (id, label) => (
    <button
      className={`btn btn--sm ${tab === id ? 'btn--primary' : 'btn--outline'}`}
      onClick={() => setTab(id)}
      style={{ fontSize: '0.85rem' }}
    >{label}</button>
  )

  return (
    <div className="app-layout">
      <Header />
      <ToastContainer toasts={toasts} />

      <main className="container--wide" style={{ padding: '32px 24px 64px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--navy)', margin: 0, letterSpacing: '-0.03em' }}>
            🩺 Panel de {user?.isAdmin ? 'Administración Clínica' : 'Acompañamiento'}
          </h1>
          <p style={{ color: 'var(--slate)', fontSize: '0.875rem', margin: '4px 0 0' }}>
            {user?.isAdmin
              ? 'Acceso completo: todos los pacientes, chats, citas y equipo.'
              : 'Tus pacientes asignados, sus chats, progreso y citas.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {tabBtn('patients', '🧑‍⚕️ Pacientes')}
          {tabBtn('calendar', '📅 Calendario')}
          {tabBtn('reports', '📊 Reportes')}
          {user?.isAdmin && tabBtn('team', '👥 Equipo')}
        </div>

        {tab === 'patients' && (
          <SectionCard
            title={`🧑‍⚕️ ${user?.isAdmin ? 'Todos los pacientes' : 'Mis pacientes'} (${patients.length})`}
            right={<button className="btn btn--outline btn--sm" onClick={loadPatients}>🔄 Refrescar</button>}
          >
            {loading ? (
              <p style={{ color: 'var(--slate)', textAlign: 'center', padding: 24 }}>Cargando...</p>
            ) : patients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--slate)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🌿</div>
                <p style={{ fontWeight: 700 }}>
                  {user?.isAdmin ? 'No hay pacientes registrados aún.' : 'Aún no tienes pacientes asignados.'}
                </p>
                {!user?.isAdmin && <p style={{ fontSize: '0.85rem' }}>Pide al administrador que te asigne pacientes.</p>}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {patients.map(p => (
                  <button
                    key={p._id}
                    onClick={() => setSelectedPatient(p._id)}
                    style={{
                      textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                      background: 'var(--cream)', border: '1px solid var(--border)',
                      borderRadius: 14, padding: '14px 16px', transition: 'transform 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--navy)' }}>{p.name}</span>
                      <RiskBadge level={p.risk.level} />
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--slate)' }}>{p.email}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--slate)', marginTop: 6 }}>
                      ⚠️ {p.risk.alertCount} alertas · {p.risk.lastAnalysis ? `último análisis ${new Date(p.risk.lastAnalysis).toLocaleDateString('es')}` : 'sin actividad'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        {tab === 'calendar' && <CalendarTab patients={patients} isAdmin={!!user?.isAdmin} notify={notify} />}
        {tab === 'reports' && <ReportsTab notify={notify} />}
        {tab === 'team' && user?.isAdmin && <TeamTab notify={notify} onChanged={loadPatients} />}
      </main>

      {selectedPatient && (
        <PatientDetail patientId={selectedPatient} onClose={() => setSelectedPatient(null)} notify={notify} />
      )}
    </div>
  )
}
