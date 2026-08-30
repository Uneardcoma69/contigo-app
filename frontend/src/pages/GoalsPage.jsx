import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext.jsx'
import Header from '../components/Header.jsx'
import ToastContainer from '../components/ToastContainer.jsx'
import ChangePasswordCard from '../components/ChangePasswordCard.jsx'
import { useToast } from '../hooks/useToast.js'
import { CATEGORIES, tinte } from '../constants.js'
import Icono from '../components/Icono.jsx'
import ProgressRing from '../components/ProgressRing.jsx'

function getCat(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[0]
}

const MEDICAL_STATUS_LABEL = {
  validada:  { text: 'Validada por tu psicólogo/a', color: 'var(--exito)', bg: 'var(--exito-bg)' },
  pendiente: { text: 'Pendiente de validación', color: 'var(--riesgo-medio)', bg: 'var(--riesgo-medio-bg)' },
  rechazada: { text: 'Requiere corrección', color: 'var(--riesgo-alto)', bg: 'var(--riesgo-alto-bg)' },
}

const MEDICAL_FIELDS = [
  { key: 'edad',               label: 'Edad',                       type: 'text' },
  { key: 'ocupacion',          label: 'Ocupación',                  type: 'text' },
  { key: 'contactoEmergencia', label: 'Contacto de emergencia',     type: 'text' },
  { key: 'telefonoEmergencia', label: 'Teléfono de emergencia',     type: 'text' },
  { key: 'condiciones',        label: 'Condiciones de salud',       type: 'textarea' },
  { key: 'medicamentos',       label: 'Medicamentos actuales',      type: 'textarea' },
  { key: 'antecedentes',       label: 'Antecedentes relevantes',    type: 'textarea' },
  { key: 'motivoConsulta',     label: 'Motivo de consulta',         type: 'textarea' },
]

// Ficha médica del paciente: se registra aquí y el staff la valida
function MedicalRecordCard({ notifySuccess, notifyError }) {
  const [record, setRecord] = useState(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    axios.get('/api/auth/medical')
      .then(({ data }) => {
        setRecord(data.record)
        if (data.record?.info) setForm(data.record.info)
      })
      .catch(() => {})
  }, [])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await axios.put('/api/auth/medical', form)
      setRecord(data.record)
      setOpen(false)
      notifySuccess('Ficha guardada. Tu psicólogo/a la revisará pronto.')
    } catch (err) {
      notifyError(err?.response?.data?.message || 'Error al guardar la ficha.')
    } finally {
      setSaving(false)
    }
  }

  const status = record ? (MEDICAL_STATUS_LABEL[record.validationStatus] || MEDICAL_STATUS_LABEL.pendiente) : null

  return (
    <div style={{
      marginTop: 32, background: 'var(--white)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: 24, boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--navy)' }}>Mi ficha médica</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--slate)' }}>
            Esta información ayuda a tu psicólogo/a a acompañarte mejor. Es privada y solo la ve el equipo clínico.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {status && (
            <span style={{ padding: '4px 12px', borderRadius: 999, background: status.bg, color: status.color, fontWeight: 600, fontSize: '0.78rem' }}>
              {status.text}
            </span>
          )}
          <button className="btn btn--outline btn--sm" onClick={() => setOpen(o => !o)}>
            {open ? 'Cerrar' : record ? 'Editar' : 'Completar ficha'}
          </button>
        </div>
      </div>

      {open && (
        <form onSubmit={save} style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {MEDICAL_FIELDS.map(f => (
            <div key={f.key} style={f.type === 'textarea' ? { gridColumn: '1 / -1' } : undefined}>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--navy)', display: 'block', marginBottom: 4 }}>{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea
                  className="form-input"
                  style={{ padding: '10px 14px', fontSize: '0.9rem', minHeight: 70, resize: 'vertical' }}
                  value={form[f.key] || ''}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                />
              ) : (
                <input
                  className="form-input"
                  style={{ padding: '10px 14px', fontSize: '0.9rem' }}
                  value={form[f.key] || ''}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
          <div style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="btn btn--primary btn--sm" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar ficha'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// Tarjeta de categoría con sus objetivos
function CategoryCard({ cat, goals, onToggle, onDelete }) {
  const total = goals.length
  const done  = goals.filter(g => g.completed).length
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100)

  if (total === 0) return null

  return (
    <div style={{
      background: 'var(--white)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
      transition: 'box-shadow 0.2s'
    }}>
      {/* Header de la tarjeta */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: tinte(cat.color, 8)
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 34, height: 34, borderRadius: 10,
            background: tinte(cat.color, 19),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.1rem'
          }}>
            <Icono nombre={cat.icono} tamano={19} />
          </span>
          <div>
            <div style={{ fontWeight: 500, fontSize: '0.95rem', color: 'var(--navy)' }}>
              {cat.label}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>
              {done} de {total} completados
            </div>
          </div>
        </div>
        <ProgressRing pct={pct} size={40} strokeWidth={4} color={pct === 100 ? 'var(--exito)' : cat.color} trackColor={tinte(cat.color, 15)}>
          <span style={{ fontWeight: 700, fontSize: '0.66rem', color: pct === 100 ? 'var(--exito)' : 'var(--navy)' }}>{pct}%</span>
        </ProgressRing>
      </div>

      {/* Lista de objetivos */}
      <div style={{ padding: '8px 0' }}>
        {goals.map(goal => (
          <div key={goal._id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 18px',
            borderBottom: '1px solid var(--cream2)',
            transition: 'background 0.15s'
          }}>
            {/* Checkbox */}
            <button
              onClick={() => onToggle(goal._id)}
              style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                border: goal.completed ? 'none' : `2px solid ${cat.color}`,
                background: goal.completed ? cat.color : 'var(--white)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', color: 'var(--sobre-acento)', fontWeight: 500,
                transition: 'all 0.2s'
              }}
            >
              {goal.completed && <Icono nombre="check" tamano={13} />}
            </button>

            {/* Texto */}
            <span style={{
              flex: 1, fontSize: '0.9rem', color: 'var(--navy)',
              textDecoration: goal.completed ? 'line-through' : 'none',
              opacity: goal.completed ? 0.5 : 1,
              transition: 'all 0.2s'
            }}>
              {goal.title}
            </span>

            {/* Eliminar */}
            <button
              onClick={() => onDelete(goal._id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--slate-light)', fontSize: '0.85rem',
                padding: '2px 4px', borderRadius: 4,
                opacity: 0.6, transition: 'opacity 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
              title="Eliminar"
            >
              <Icono nombre="cerrar" tamano={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function GoalsPage() {
  const { user } = useAuth()
  const { toasts, success, error: showError } = useToast()

  const [goals,    setGoals]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [title,    setTitle]    = useState('')
  const [category, setCategory] = useState('general')
  const [adding,   setAdding]   = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [filter,   setFilter]   = useState('todas')

  useEffect(() => {
    if (!user) return
    axios.get('/api/goals')
      .then(({ data }) => setGoals(data.goals))
      .catch(() => showError('No se pudo cargar los objetivos.'))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line

  // Importante: el return condicional va DESPUÉS de todos los hooks
  // (las reglas de React exigen que los hooks se llamen siempre en el mismo orden)
  if (!user) return <Navigate to="/login" replace />

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    setAdding(true)
    try {
      const { data } = await axios.post('/api/goals', { title, category })
      setGoals(prev => [...prev, data.goal])
      setTitle('')
      setCategory('general')
      setShowForm(false)
      success('Objetivo agregado')
    } catch (err) {
      showError(err?.response?.data?.message || 'Error al agregar.')
    } finally {
      setAdding(false)
    }
  }

  const handleToggle = async (id) => {
    try {
      const { data } = await axios.patch(`/api/goals/${id}`)
      setGoals(prev => prev.map(g => g._id === id ? data.goal : g))
    } catch {
      showError('No se pudo actualizar.')
    }
  }

  const handleDelete = async (id) => {
    const meta = goals.find(g => g._id === id)
    if (!window.confirm(`¿Eliminar "${meta?.title ?? 'este objetivo'}"?`)) return
    try {
      await axios.delete(`/api/goals/${id}`)
      setGoals(prev => prev.filter(g => g._id !== id))
      success('Objetivo eliminado')
    } catch {
      showError('No se pudo eliminar.')
    }
  }

  const total = goals.length
  const done  = goals.filter(g => g.completed).length
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100)

  // Goals filtered
  const filtered = filter === 'todas' ? goals
    : filter === 'pendientes'  ? goals.filter(g => !g.completed)
    : filter === 'completados' ? goals.filter(g => g.completed)
    : goals.filter(g => g.category === filter)

  // Group by category for card view
  const byCat = CATEGORIES.map(cat => ({
    cat,
    goals: filtered.filter(g => g.category === cat.id)
  })).filter(x => x.goals.length > 0)

  return (
    <div className="app-layout" style={{ position: 'relative', overflow: 'hidden' }}>
      
      {/* Background Blobs for Goals */}
      <div className="anim-pulse" style={{
        position: 'fixed', top: '-15%', left: '-10%', width: '50vw', height: '50vw',
        background: 'radial-gradient(circle, var(--teal-pale) 0%, transparent 60%)',
        borderRadius: '50%', zIndex: 0, opacity: 0.7
      }} />
      <div className="anim-float" style={{
        position: 'fixed', bottom: '-10%', right: '-10%', width: '60vw', height: '60vw',
        background: 'radial-gradient(circle, var(--sage-pale) 0%, transparent 70%)',
        borderRadius: '50%', zIndex: 0, opacity: 0.8
      }} />

      <Header />
      <ToastContainer toasts={toasts} />

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px', position: 'relative', zIndex: 1 }}>

        {/* Título */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--navy)', margin: 0, letterSpacing: '-0.03em' }}>
              Mis objetivos
            </h1>
            <p style={{ color: 'var(--slate)', fontSize: '0.875rem', margin: '4px 0 0' }}>
              Pequeños pasos hacia el bienestar
            </p>
          </div>
          <button className="btn btn--primary btn--sm" onClick={() => setShowForm(f => !f)}>
            {showForm ? 'Cancelar' : '+ Nuevo'}
          </button>
        </div>

        {/* Resumen general */}
        {total > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
            background: 'var(--white)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)', padding: '24px 28px',
            marginBottom: 24, boxShadow: 'var(--shadow-md)'
          }}>
            <ProgressRing pct={pct} size={90} strokeWidth={9} color="var(--teal)" trackColor="var(--surface-warm)">
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 500, color: 'var(--navy)' }}>{pct}%</span>
            </ProgressRing>
            <div>
              <span style={{ fontWeight: 500, color: 'var(--navy)', display: 'block', marginBottom: 6 }}>Progreso total</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--slate)' }}>{done} completados · {total - done} pendientes</span>
            </div>
          </div>
        )}

        {/* Formulario */}
        {showForm && (
          <form onSubmit={handleAdd} className="anim-bubbleIn" style={{
            background: 'var(--white)',
            border: '1px solid var(--teal-light)',
            borderRadius: 'var(--radius-xl)',
            padding: 28, marginBottom: 28,
            boxShadow: 'var(--shadow-md)'
          }}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">¿Cuál es tu objetivo?</label>
              <input
                className="form-input"
                placeholder="Ej: Meditar 10 minutos cada mañana"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={120}
                autoFocus
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Categoría</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    style={{
                      padding: '6px 14px', borderRadius: 999,
                      border: `2px solid ${category === cat.id ? cat.color : 'var(--border)'}`,
                      background: category === cat.id ? tinte(cat.color, 13) : 'var(--white)',
                      color: category === cat.id ? 'var(--navy)' : 'var(--slate)',
                      fontWeight: category === cat.id ? 600 : 400,
                      fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.15s'
                    }}
                  >
                    <Icono nombre={cat.icono} tamano={19} /> {cat.label}
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" className="btn btn--primary btn--full" disabled={adding || !title.trim()}>
              {adding ? 'Agregando...' : 'Agregar objetivo'}
            </button>
          </form>
        )}

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
          {[
            { id: 'todas',        label: `Todas (${total})` },
            { id: 'pendientes',   label: `Pendientes` },
            { id: 'completados',  label: `Completados` },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              padding: '5px 12px', borderRadius: 999,
              border: filter === f.id ? '1px solid var(--teal)' : '1px solid var(--line)',
              background: filter === f.id ? 'var(--teal-pale)' : 'var(--white)',
              color: filter === f.id ? 'var(--teal-dark)' : 'var(--slate)',
              fontWeight: filter === f.id ? 600 : 400,
              fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.15s'
            }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <span className="spinner spinner--dark" style={{ width: 28, height: 28 }} />
          </div>
        ) : byCat.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '64px 24px',
            background: 'var(--white)', borderRadius: 'var(--radius-xl)',
            border: 'none', boxShadow: 'var(--shadow-md)'
          }}>
            <div style={{ marginBottom: 14, color: 'var(--slate-light)' }}><Icono nombre="hoja" tamano={40} /></div>
            <p style={{ fontWeight: 500, color: 'var(--navy)', fontSize: '1rem', margin: '0 0 6px' }}>
              {filter === 'todas' ? '¡Aquí empezará tu camino!' : 'No hay objetivos aquí'}
            </p>
            <p style={{ color: 'var(--slate)', fontSize: '0.875rem', margin: '0 0 20px' }}>
              {filter === 'todas'
                ? 'Agrega tu primer objetivo o chatea con Contigo para recibir sugerencias personalizadas.'
                : 'Prueba cambiar el filtro.'}
            </p>
            {filter === 'todas' && (
              <button className="btn btn--primary" onClick={() => setShowForm(true)}>
                + Agregar primer objetivo
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {byCat.map(({ cat, goals: catGoals }) => (
              <CategoryCard
                key={cat.id}
                cat={cat}
                goals={catGoals}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Celebración */}
        {total > 0 && done === total && (
          <div style={{
            position: 'relative', overflow: 'hidden', marginTop: 32, textAlign: 'center',
            padding: 'clamp(40px, 6vw, 64px) 28px', background: 'var(--teal)', borderRadius: 'var(--radius-xl)'
          }}>
            <div style={{
              position: 'absolute', top: -140, left: '50%', transform: 'translateX(-50%)',
              width: 420, height: 420, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,200,87,0.22) 0%, rgba(255,200,87,0) 68%)', pointerEvents: 'none'
            }} />
            <div style={{ position: 'relative' }}>
              <div className="anim-pulse" style={{
                width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,200,87,0.16)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--dorado)'
              }}><Icono nombre="fiesta" tamano={32} /></div>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', color: 'var(--sobre-acento)', margin: '0 0 10px' }}>
                Completaste todos tus objetivos
              </p>
              <p style={{ color: 'var(--muted-on-dark)', fontSize: '0.95rem', margin: 0 }}>
                Eso no fue suerte: fue constancia. Tómate el momento antes de poner el siguiente.
              </p>
            </div>
          </div>
        )}


        {/* Ficha médica */}
        <MedicalRecordCard notifySuccess={success} notifyError={showError} />

        {/* Mi cuenta */}
        <ChangePasswordCard notifySuccess={success} notifyError={showError} />
      </main>
    </div>
  )
}
