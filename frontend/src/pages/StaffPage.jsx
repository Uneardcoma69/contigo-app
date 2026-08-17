import { useState, useEffect, useCallback, useMemo } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext.jsx'
import Header from '../components/Header.jsx'
import ToastContainer from '../components/ToastContainer.jsx'
import ChangePasswordCard from '../components/ChangePasswordCard.jsx'
import RiskBadge from '../components/RiskBadge.jsx'
import { useToast } from '../hooks/useToast.js'
import { LEVEL_CONFIG, MEDICAL_STATUS, APPT_STATUS, ROLE_LABEL } from '../constants.js'

function SectionCard({ title, children, right }) {
  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

/** Métrica breve: una cifra con su etiqueta y, si aporta, un pie. */
function Stat({ label, value, foot, color }) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value" style={color ? { color } : undefined}>{value}</div>
      {foot && <div className="stat__foot">{foot}</div>}
    </div>
  )
}

/** Mensaje cuando todavía no hay nada que mostrar. */
function Empty({ icon = '🌿', title, text }) {
  return (
    <div className="empty">
      <div className="empty__icon" aria-hidden="true">{icon}</div>
      <p className="empty__title">{title}</p>
      {text && <p className="empty__text">{text}</p>}
    </div>
  )
}

/* ═══════════ Detalle de paciente (expediente) ═══════════ */
function PatientDetail({ patientId, onClose, notify, canManageClinical }) {
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
      role="tab"
      aria-selected={tab === id}
      className="tab"
      onClick={() => setTab(id)}
    >{label}</button>
  )

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal admin-modal--wide" onClick={e => e.stopPropagation()}>
        {loading || !data ? (
          <div className="empty"><p className="empty__title">Cargando expediente…</p></div>
        ) : (
          <>
            <div className="expediente__head">
              <div>
                <h2 className="expediente__nombre">{data.patient.name}</h2>
                <p className="meta">{data.patient.email}</p>
              </div>
              <div className="row gap-3">
                <RiskBadge level={data.risk.level} />
                <button
                  className="icon-btn"
                  onClick={onClose}
                  aria-label="Cerrar el expediente"
                  title="Cerrar"
                >✕</button>
              </div>
            </div>

            {/* Progreso */}
            <div className="row gap-3" style={{ marginBottom: 'var(--space-4)' }}>
              <div className="stat">
                <div className="stat__label">Progreso de metas</div>
                <div className="stat__value">
                  {data.progress.completedGoals}/{data.progress.totalGoals}{' '}
                  <span className="stat__pct">({data.progress.pct}%)</span>
                </div>
                <div className="progress" role="progressbar" aria-valuenow={data.progress.pct} aria-valuemin="0" aria-valuemax="100">
                  <div className="progress__fill" style={{ width: `${data.progress.pct}%` }} />
                </div>
              </div>
              <Stat
                label="Alertas de riesgo"
                value={data.risk.alerts?.length || 0}
                foot={`score máx: ${data.risk.score}`}
                color={LEVEL_CONFIG[data.risk.level]?.color}
              />
            </div>

            <div className="tabs" role="tablist" aria-label="Secciones del expediente">
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
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: m.role === 'user' ? 'var(--teal-dark)' : 'var(--slate)', marginBottom: 2 }}>
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
                      <div style={{ fontWeight: 500, fontSize: '0.9rem', textDecoration: g.completed ? 'line-through' : 'none', color: g.completed ? 'var(--slate)' : 'var(--navy)' }}>{g.title}</div>
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
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--teal-dark)', marginBottom: 2 }}>
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
                          <span style={{ padding: '4px 12px', borderRadius: 999, background: st.bg, color: st.color, fontWeight: 600, fontSize: '0.8rem' }}>
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
                          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k}</div>
                          <div style={{ fontSize: '0.9rem', color: 'var(--navy)', fontWeight: 600 }}>{v || '—'}</div>
                        </div>
                      ))}
                    </div>
                    {canManageClinical ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn--secondary btn--sm" onClick={() => validateMedical('validada')}>✅ Validar</button>
                        <button className="btn btn--outline btn--sm" onClick={() => validateMedical('rechazada')} style={{ color: '#b91c1c' }}>❌ Rechazar</button>
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.82rem', color: 'var(--slate)', margin: 0 }}>
                        🔒 Solo un psicólogo/a puede validar la ficha médica.
                      </p>
                    )}
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

function CalendarTab({ patients, isAdmin, notify, canManageClinical }) {
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
    // Eliminar una cita no tiene vuelta atrás y afecta también al
    // paciente, así que se confirma antes.
    const cuando = new Date(appt.date).toLocaleString('es', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
    })
    if (!window.confirm(`¿Eliminar la cita de ${appt.patientName} del ${cuando}?\n\nEsta acción no se puede deshacer.`)) return
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn--outline btn--sm" onClick={() => moveWeek(-1)}>← Anterior</button>
          <button className="btn btn--outline btn--sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>Hoy</button>
          <button className="btn btn--outline btn--sm" onClick={() => moveWeek(1)}>Siguiente →</button>
          {canManageClinical && (
            <button className="btn btn--primary btn--sm" onClick={() => setShowForm(s => !s)}>{showForm ? 'Cerrar' : '+ Nueva cita'}</button>
          )}
        </div>
      }
    >
      {!canManageClinical && (
        <p style={{ fontSize: '0.85rem', color: 'var(--slate)', marginTop: 0, marginBottom: 16 }}>
          🔒 Vista de solo lectura. La gestión de citas la realiza el psicólogo/a asignado.
        </p>
      )}
      {showForm && canManageClinical && (
        <form onSubmit={createAppt} style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10,
          background: 'var(--sage-pale)', padding: 16, borderRadius: 14, marginBottom: 18, alignItems: 'end'
        }}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 500 }}>Paciente</label>
            <select className="form-input" style={{ padding: '10px 14px' }} value={form.patientId} onChange={e => setForm(f => ({ ...f, patientId: e.target.value }))}>
              <option value="">Selecciona...</option>
              {patients.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          {isAdmin && (
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 500 }}>Psicólogo/a</label>
              <select className="form-input" style={{ padding: '10px 14px' }} value={form.psychologistId} onChange={e => setForm(f => ({ ...f, psychologistId: e.target.value }))}>
                <option value="">Yo mismo/a</option>
                {team.map(t => <option key={t._id} value={t._id}>{t.name} ({ROLE_LABEL[t.role]})</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 500 }}>Fecha</label>
            <input type="date" className="form-input" style={{ padding: '10px 14px' }} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 500 }}>Hora</label>
            <input type="time" className="form-input" style={{ padding: '10px 14px' }} value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 500 }}>Duración (min)</label>
            <input type="number" min="20" max="180" step="5" className="form-input" style={{ padding: '10px 14px' }} value={form.durationMin} onChange={e => setForm(f => ({ ...f, durationMin: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 500 }}>Modalidad</label>
            <select className="form-input" style={{ padding: '10px 14px' }} value={form.modality} onChange={e => setForm(f => ({ ...f, modality: e.target.value }))}>
              <option value="online">En línea</option>
              <option value="presencial">Presencial</option>
            </select>
          </div>
          <button type="submit" className="btn btn--primary btn--sm">Agendar</button>
        </form>
      )}

      {/* Cada día no baja de 90px: con 1fr puro las columnas se encogían
          a 40px en un teléfono y no se podía leer ninguna cita. Si no
          caben, la rejilla se desplaza en horizontal. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(90px, 1fr))', gap: 8, overflowX: 'auto', minWidth: 0, paddingBottom: 4 }}>
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
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--slate)', textTransform: 'uppercase' }}>
                  {day.toLocaleDateString('es', { weekday: 'short' })}
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 600, color: isToday ? 'var(--teal-dark)' : 'var(--navy)' }}>
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
                      <div style={{ fontWeight: 600, color: st.color }}>{time} · {a.durationMin}min</div>
                      <div style={{ fontWeight: 500, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.patientName}</div>
                      <div style={{ color: 'var(--slate)' }}>{a.modality === 'online' ? '💻' : '🏢'} {st.label}</div>
                      {a.status === 'programada' && canManageClinical && (
                        <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
                          <button
                            className="cita-accion"
                            aria-label={`Marcar como completada la cita de ${a.patientName}`}
                            title="Marcar como completada"
                            onClick={() => setStatus(a, 'completada')}
                          >✅</button>
                          <button
                            className="cita-accion"
                            aria-label={`Cancelar la cita de ${a.patientName}`}
                            title="Cancelar"
                            onClick={() => setStatus(a, 'cancelada')}
                          >🚫</button>
                          <button
                            className="cita-accion"
                            aria-label={`Eliminar la cita de ${a.patientName}`}
                            title="Eliminar"
                            onClick={() => removeAppt(a)}
                          >🗑️</button>
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
  const statBox = (label, value, sub, color) => (
    <Stat label={label} value={value} foot={sub} color={color} />
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
                  <td style={{ padding: '10px', fontWeight: 500 }}>{p.name}</td>
                  <td style={{ padding: '10px' }}><RiskBadge level={p.level} /></td>
                  <td style={{ padding: '10px', fontWeight: 500 }}>{p.alerts}</td>
                  <td style={{ padding: '10px' }}>{p.goalsCompleted}/{p.goals} ({p.goalsPct}%)</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ color: med.color, fontWeight: 500 }}>{med.emoji} {med.label}</span>
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

/* Restablecer la contraseña de otra persona (solo admin).
   No hay servicio de correo: el admin define una contraseña temporal
   y se la entrega por un canal seguro. */
function ResetPasswordButton({ person, notify }) {
  const [open, setOpen] = useState(false)
  const [pass, setPass] = useState('')
  const [saving, setSaving] = useState(false)

  const reset = async () => {
    if (pass.length < 6) {
      notify.error('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setSaving(true)
    try {
      await axios.put(`/api/admin/users/${person._id}/password`, { newPassword: pass })
      notify.success(`Contraseña de ${person.name} restablecida. Sus sesiones se cerraron.`)
      setPass('')
      setOpen(false)
    } catch (err) {
      notify.error(err?.response?.data?.message || 'Error al restablecer la contraseña.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        className="btn btn--outline btn--sm"
        style={{ fontSize: '0.78rem', padding: '5px 12px' }}
        onClick={() => setOpen(true)}
        title={`Restablecer la contraseña de ${person.name}`}
      >
        🔑 Contraseña
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        type="text"
        className="form-input"
        style={{ padding: '6px 12px', fontSize: '0.82rem', width: 190 }}
        placeholder="Contraseña temporal"
        value={pass}
        onChange={e => setPass(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && reset()}
        autoComplete="off"
        autoFocus
      />
      <button className="btn btn--primary btn--sm" style={{ fontSize: '0.78rem', padding: '5px 12px' }} onClick={reset} disabled={saving}>
        Aplicar
      </button>
      <button className="btn btn--ghost btn--sm" style={{ fontSize: '0.78rem', padding: '5px 10px' }} onClick={() => { setOpen(false); setPass('') }}>
        ✕
      </button>
    </div>
  )
}

/* ═══════════ Equipo (solo admin) ═══════════ */
function TeamTab({ notify, onChanged }) {
  const { user } = useAuth()
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
            <label style={{ fontSize: '0.78rem', fontWeight: 500 }}>Nombre</label>
            <input className="form-input" style={{ padding: '10px 14px' }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 500 }}>Correo</label>
            <input type="email" className="form-input" style={{ padding: '10px 14px' }} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 500 }}>Contraseña</label>
            <input type="password" className="form-input" style={{ padding: '10px 14px' }} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={6} />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 500 }}>Rol</label>
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
                width: 36, height: 36, borderRadius: '50%', background: 'var(--teal-pale)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: '0.85rem'
              }}>
                {m.name[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{m.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>{m.email}</div>
              </div>
              <span style={{ padding: '3px 10px', borderRadius: 999, background: 'var(--teal-pale)', color: 'var(--teal-dark)', fontWeight: 600, fontSize: '0.75rem' }}>
                {ROLE_LABEL[m.role]}
              </span>
              {m._id === user?.id ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--slate)', fontWeight: 600 }}>Tu cuenta</span>
              ) : (
                <ResetPasswordButton person={m} notify={notify} />
              )}
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
              <div key={p._id} className="row-item">
                <div className="row-item__main">
                  <div className="row-item__titulo">{p.name}</div>
                  <div className="meta">{p.email}</div>
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
                <ResetPasswordButton person={p} notify={notify} />
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  )
}

/* ═══════════ Mensajes de contacto (solo admin) ═══════════ */
/* ═══════════ Registro de auditoría (solo admin) ═══════════ */
function AuditTab({ notify }) {
  const [datos, setDatos] = useState(null)
  const [filtro, setFiltro] = useState('')
  const [pagina, setPagina] = useState(0)
  const porPagina = 50

  const load = useCallback(() => {
    const params = new URLSearchParams({ limit: porPagina, offset: pagina * porPagina })
    if (filtro) params.set('action', filtro)
    axios.get(`/api/admin/audit-log?${params}`)
      .then(({ data }) => setDatos(data))
      .catch(() => notify.error('Error al cargar el registro.'))
  }, [notify, filtro, pagina])

  useEffect(() => { load() }, [load])

  if (!datos) return <SectionCard title="📋 Registro de auditoría"><p style={{ color: 'var(--slate)' }}>Cargando...</p></SectionCard>

  const totalPaginas = Math.ceil(datos.total / porPagina)
  const fmt = d => new Date(d).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <SectionCard
      title={`📋 Registro de auditoría (${datos.total})`}
      right={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="form-input"
            style={{ padding: '7px 12px', width: 'auto', fontSize: '0.85rem' }}
            value={filtro}
            onChange={e => { setFiltro(e.target.value); setPagina(0) }}
            aria-label="Filtrar por tipo de acción"
          >
            <option value="">Todas las acciones</option>
            {Object.entries(datos.acciones || {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn btn--outline btn--sm" onClick={load}>🔄 Refrescar</button>
        </div>
      }
    >
      <p style={{ fontSize: '0.85rem', color: 'var(--slate)', marginTop: 0, marginBottom: 16 }}>
        Queda constancia de quién consultó o modificó información clínica. Las entradas
        solo se añaden: no pueden editarse ni borrarse desde la aplicación.
      </p>

      {datos.entries.length === 0 ? (
        <Empty icon="🗒️" title="Todavía no hay actividad registrada." />
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table className="alert-table">
              <thead>
                <tr>
                  <th>Cuándo</th>
                  <th>Quién</th>
                  <th>Hizo qué</th>
                  <th>Sobre quién</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {datos.entries.map(e => (
                  <tr key={e._id}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--slate)', fontSize: '0.82rem' }}>{fmt(e.createdAt)}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{e.actorName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>{ROLE_LABEL[e.actorRole] || e.actorRole}</div>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{e.actionLabel}</td>
                    <td style={{ fontSize: '0.85rem' }}>{e.targetName || '—'}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--slate)', maxWidth: 240 }}>{e.details || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
              <button className="btn btn--outline btn--sm" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>← Anterior</button>
              <span style={{ fontSize: '0.85rem', color: 'var(--slate)' }}>Página {pagina + 1} de {totalPaginas}</span>
              <button className="btn btn--outline btn--sm" disabled={pagina + 1 >= totalPaginas} onClick={() => setPagina(p => p + 1)}>Siguiente →</button>
            </div>
          )}
        </>
      )}
    </SectionCard>
  )
}

function MessagesTab({ notify }) {
  const [messages, setMessages] = useState([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(() => {
    axios.get('/api/admin/contact-messages')
      .then(({ data }) => setMessages(data.messages))
      .catch(() => notify.error('Error al cargar los mensajes.'))
      .finally(() => setLoaded(true))
  }, [notify])

  useEffect(() => { load() }, [load])

  return (
    <SectionCard
      title={`📨 Mensajes de contacto (${messages.length})`}
      right={<button className="btn btn--outline btn--sm" onClick={load}>🔄 Refrescar</button>}
    >
      {!loaded ? (
        <p style={{ color: 'var(--slate)' }}>Cargando...</p>
      ) : messages.length === 0 ? (
        <Empty icon="📭" title="Aún no hay mensajes del formulario de contacto." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map(m => (
            <div key={m._id} style={{
              background: 'var(--cream)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '14px 18px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{m.nombre}</span>
                  <span style={{ color: 'var(--slate)', fontSize: '0.85rem' }}> · {m.correo}</span>
                  {m.telefono && <span style={{ color: 'var(--slate)', fontSize: '0.85rem' }}> · {m.telefono}</span>}
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--slate)' }}>
                  {new Date(m.createdAt).toLocaleString('es')}
                </span>
              </div>
              {m.motivo && (
                <span style={{
                  display: 'inline-block', marginBottom: 8, padding: '2px 10px', borderRadius: 999,
                  background: 'var(--teal-pale)', color: 'var(--teal-dark)', fontWeight: 500, fontSize: '0.75rem'
                }}>{m.motivo}</span>
              )}
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--navy)', whiteSpace: 'pre-wrap' }}>{m.mensaje}</p>
              <a href={`mailto:${m.correo}`} className="btn btn--outline btn--sm" style={{ marginTop: 10, fontSize: '0.8rem' }}>
                ✉️ Responder
              </a>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

/* ═══════════ Ajustes (solo admin) ═══════════ */
function SettingsTab({ notify }) {
  const [settings, setSettings] = useState(null)
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    axios.get('/api/admin/settings')
      .then(({ data }) => setSettings(data))
      .catch(() => notify.error('Error al cargar los ajustes.'))
  }, [notify])

  useEffect(() => { load() }, [load])

  const save = async (nuevaClave) => {
    setSaving(true)
    try {
      const { data } = await axios.put('/api/admin/settings', { deepseekApiKey: nuevaClave })
      setSettings(data)
      setKey('')
      notify.success(nuevaClave ? 'Clave guardada. La IA ya está activa. 🤖' : 'Clave eliminada. El chat vuelve al modo demo.')
    } catch (err) {
      notify.error(err?.response?.data?.message || 'Error al guardar los ajustes.')
    } finally {
      setSaving(false)
    }
  }

  if (!settings) return <SectionCard title="⚙️ Ajustes"><p style={{ color: 'var(--slate)' }}>Cargando...</p></SectionCard>

  return (
    <SectionCard title="⚙️ Ajustes de la aplicación">
      <div style={{ marginBottom: 18 }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--navy)', margin: '0 0 4px' }}>
          🤖 Asistente conversacional
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--slate)', margin: '0 0 12px' }}>
          Sin una clave de DeepSeek, el chat responde con mensajes de ejemplo (modo demo).
          Con la clave configurada, las respuestas las genera la IA.
        </p>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14,
          padding: '6px 14px', borderRadius: 999,
          background: settings.aiConfigured ? '#f0fdf4' : 'var(--sage-pale)',
          border: `1.5px solid ${settings.aiConfigured ? '#bbf7d0' : 'var(--sage-light)'}`,
          color: settings.aiConfigured ? '#16a34a' : 'var(--slate)',
          fontWeight: 600, fontSize: '0.82rem'
        }}>
          {settings.aiConfigured
            ? `✅ IA activa (${settings.provider}) · clave ${settings.keyPreview}`
            : '🧪 Modo demo (sin clave configurada)'}
        </div>

        {settings.canEdit ? (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="password"
                className="form-input"
                style={{ padding: '10px 16px', fontSize: '0.9rem', flex: '1 1 260px' }}
                placeholder="Pega aquí tu clave de DeepSeek (sk-...)"
                value={key}
                onChange={e => setKey(e.target.value)}
                autoComplete="off"
              />
              <button
                className="btn btn--primary btn--sm"
                onClick={() => save(key.trim())}
                disabled={saving || !key.trim()}
              >
                Guardar clave
              </button>
              {settings.aiConfigured && (
                <button
                  className="btn btn--outline btn--sm"
                  onClick={() => save('')}
                  disabled={saving}
                  style={{ color: '#b91c1c' }}
                >
                  Quitar clave
                </button>
              )}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--slate)', marginTop: 10, marginBottom: 0 }}>
              🔒 La clave se guarda solo en este equipo y nunca se muestra completa.
            </p>
          </>
        ) : (
          <p style={{ fontSize: '0.85rem', color: 'var(--slate)', margin: 0 }}>
            🔒 En modo servidor, la clave se configura con variables de entorno.
          </p>
        )}
      </div>
    </SectionCard>
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

  // El monitor observa y anota, pero no valida fichas ni gestiona citas
  const isMonitor = user?.role === 'monitor'
  const canManageClinical = !isMonitor

  const loadPatients = useCallback(() => {
    axios.get('/api/staff/patients')
      .then(({ data }) => setPatients(data.patients))
      .catch(err => error(err?.response?.data?.message || 'Error al cargar pacientes.'))
      .finally(() => setLoading(false))
  }, [error])

  useEffect(() => { loadPatients() }, [loadPatients])

  // Las pestañas viven en un carril; la activa se eleva sobre él en vez
  // de pintarse de color, que es menos ruidoso cuando son siete.
  const tabBtn = (id, label) => (
    <button
      role="tab"
      aria-selected={tab === id}
      className="tab"
      onClick={() => setTab(id)}
    >{label}</button>
  )

  return (
    <div className="app-layout">
      <Header />
      <ToastContainer toasts={toasts} />

      <main className="container--wide page">
        <header className="page-head">
          <h1 className="page-head__title">
            Panel de {user?.isAdmin ? 'administración clínica' : isMonitor ? 'seguimiento' : 'acompañamiento'}
          </h1>
          <p className="page-head__sub">
            {user?.isAdmin
              ? 'Acceso completo: todos los pacientes, chats, citas y equipo.'
              : isMonitor
                ? 'Seguimiento de tus pacientes asignados: chats, progreso y notas.'
                : 'Tus pacientes asignados, sus chats, progreso y citas.'}
          </p>
        </header>

        <div className="tabs" role="tablist" aria-label="Secciones del panel">
          {tabBtn('patients', '🧑‍⚕️ Pacientes')}
          {tabBtn('calendar', '📅 Calendario')}
          {tabBtn('reports', '📊 Reportes')}
          {user?.isAdmin && tabBtn('team', '👥 Equipo')}
          {user?.isAdmin && tabBtn('messages', '📨 Mensajes')}
          {user?.isAdmin && tabBtn('audit', '📋 Auditoría')}
          {user?.isAdmin && tabBtn('settings', '⚙️ Ajustes')}
          {tabBtn('account', '🔐 Mi cuenta')}
        </div>

        {tab === 'patients' && (
          <SectionCard
            title={`🧑‍⚕️ ${user?.isAdmin ? 'Todos los pacientes' : 'Mis pacientes'} (${patients.length})`}
            right={<button className="btn btn--outline btn--sm" onClick={loadPatients}>🔄 Refrescar</button>}
          >
            {loading ? (
              <p style={{ color: 'var(--slate)', textAlign: 'center', padding: 24 }}>Cargando...</p>
            ) : patients.length === 0 ? (
              <Empty
                title={user?.isAdmin ? 'No hay pacientes registrados aún.' : 'Aún no tienes pacientes asignados.'}
                text={!user?.isAdmin ? 'Pide al administrador que te asigne pacientes.' : undefined}
              />
            ) : (
              <div className="card-grid">
                {patients.map(p => (
                  <button
                    key={p._id}
                    className="paciente-card"
                    onClick={() => setSelectedPatient(p._id)}
                    aria-label={`Abrir el expediente de ${p.name}`}
                  >
                    <div className="paciente-card__top">
                      <span className="paciente-card__nombre">{p.name}</span>
                      <RiskBadge level={p.risk.level} />
                    </div>
                    <div className="meta">{p.email}</div>
                    <div className="meta paciente-card__pie">
                      {p.risk.alertCount} alertas · {p.risk.lastAnalysis
                        ? `último análisis ${new Date(p.risk.lastAnalysis).toLocaleDateString('es')}`
                        : 'sin actividad'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        {tab === 'calendar' && <CalendarTab patients={patients} isAdmin={!!user?.isAdmin} notify={notify} canManageClinical={canManageClinical} />}
        {tab === 'reports' && <ReportsTab notify={notify} />}
        {tab === 'team' && user?.isAdmin && <TeamTab notify={notify} onChanged={loadPatients} />}
        {tab === 'messages' && user?.isAdmin && <MessagesTab notify={notify} />}
        {tab === 'audit' && user?.isAdmin && <AuditTab notify={notify} />}
        {tab === 'settings' && user?.isAdmin && <SettingsTab notify={notify} />}
        {tab === 'account' && (
          <div style={{ marginTop: -32 }}>
            <ChangePasswordCard notifySuccess={success} notifyError={error} />
          </div>
        )}
      </main>

      {selectedPatient && (
        <PatientDetail
          patientId={selectedPatient}
          onClose={() => setSelectedPatient(null)}
          notify={notify}
          canManageClinical={canManageClinical}
        />
      )}
    </div>
  )
}
