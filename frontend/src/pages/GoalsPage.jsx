import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext.jsx'
import Header from '../components/Header.jsx'
import Icon from '../components/Icon.jsx'
import ToastContainer from '../components/ToastContainer.jsx'
import { useToast } from '../hooks/useToast.js'

const CATEGORIES = [
  { id: 'general',   label: 'General',   icon: 'star',     color: '#f6ad55' },
  { id: 'bienestar', label: 'Bienestar', icon: 'leaf',     color: '#68d391' },
  { id: 'sueño',     label: 'Sueño',     icon: 'moon',     color: '#76e4f7' },
  { id: 'ejercicio', label: 'Ejercicio', icon: 'dumbbell', color: '#fc8181' },
  { id: 'mente',     label: 'Mente',     icon: 'brain',    color: '#b794f4' },
  { id: 'social',    label: 'Social',    icon: 'users',    color: '#63b3ed' },
]

function getCat(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[0]
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
        background: `${cat.color}15`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 34, height: 34, borderRadius: 10,
            background: `${cat.color}25`,
            color: cat.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Icon name={cat.icon} size={18} strokeWidth={1.8} />
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy)' }}>
              {cat.label}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>
              {done} de {total} completados
            </div>
          </div>
        </div>
        <div style={{
          fontWeight: 800, fontSize: '1.1rem',
          color: pct === 100 ? '#38a169' : 'var(--navy)'
        }}>
          {pct}%
        </div>
      </div>

      {/* Barra de progreso */}
      <div style={{ height: 5, background: 'var(--cream2)' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: cat.color,
          transition: 'width 0.5s ease',
          borderRadius: '0 2px 2px 0'
        }} />
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
                fontSize: '0.75rem', color: 'white', fontWeight: 700,
                transition: 'all 0.2s'
              }}
            >
              {goal.completed && '✓'}
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
                color: 'var(--slate-light)',
                padding: '4px', borderRadius: 6,
                display: 'flex', alignItems: 'center',
                opacity: 0.55, transition: 'opacity 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.55'}
              title="Eliminar"
              aria-label="Eliminar objetivo"
            >
              <Icon name="close" size={14} />
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

  if (!user) return <Navigate to="/login" replace />

  useEffect(() => {
    axios.get('/api/goals')
      .then(({ data }) => setGoals(data.goals))
      .catch(() => showError('No se pudo cargar los objetivos.'))
      .finally(() => setLoading(false))
  }, [])

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
    <div className="app-layout">
      <Header />
      <ToastContainer toasts={toasts} />

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px' }}>

        {/* Título */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg, var(--teal), var(--sage))',
              color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <Icon name="target" size={20} />
            </span>
            <div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--navy)', margin: 0, letterSpacing: '-0.03em' }}>
                Mis objetivos
              </h1>
              <p style={{ color: 'var(--slate)', fontSize: '0.875rem', margin: '2px 0 0' }}>
                Pequeños pasos hacia el bienestar
              </p>
            </div>
          </div>
          <button className="btn btn--primary btn--sm" onClick={() => setShowForm(f => !f)}>
            {showForm
              ? <><Icon name="close" size={14} /> Cancelar</>
              : <><Icon name="plus" size={14} /> Nuevo</>}
          </button>
        </div>

        {/* Resumen general */}
        {total > 0 && (
          <div style={{
            background: 'var(--white)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '18px 20px',
            marginBottom: 20, boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontWeight: 700, color: 'var(--navy)' }}>Progreso total</span>
              <span style={{ fontWeight: 800, color: 'var(--teal-dark)', fontSize: '1.1rem' }}>
                {pct}%
              </span>
            </div>
            <div style={{ height: 12, background: 'var(--cream2)', borderRadius: 99, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: 'linear-gradient(90deg, var(--teal), var(--sage))',
                borderRadius: 99, transition: 'width 0.5s ease'
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--slate)' }}>{done} completados</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--slate)' }}>{total - done} pendientes</span>
            </div>
          </div>
        )}

        {/* Formulario */}
        {showForm && (
          <form onSubmit={handleAdd} style={{
            background: 'var(--white)',
            border: '1.5px solid var(--teal-light)',
            borderRadius: 'var(--radius-lg)',
            padding: 20, marginBottom: 20,
            boxShadow: 'var(--shadow-sm)'
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
                      padding: '6px 12px', borderRadius: 999,
                      border: `2px solid ${category === cat.id ? cat.color : 'var(--border)'}`,
                      background: category === cat.id ? `${cat.color}20` : 'var(--white)',
                      color: category === cat.id ? 'var(--navy)' : 'var(--slate)',
                      fontWeight: category === cat.id ? 700 : 500,
                      fontSize: '0.82rem', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      transition: 'all 0.15s'
                    }}
                  >
                    <Icon name={cat.icon} size={13} color={category === cat.id ? cat.color : 'currentColor'} strokeWidth={1.8} />
                    {cat.label}
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
            { id: 'todas',        label: `Todas (${total})`,  icon: null },
            { id: 'pendientes',   label: 'Pendientes',         icon: 'hourglass' },
            { id: 'completados',  label: 'Completados',        icon: 'check' },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              padding: '5px 12px', borderRadius: 999,
              border: filter === f.id ? '2px solid var(--teal)' : '2px solid var(--border)',
              background: filter === f.id ? 'var(--teal-pale)' : 'var(--white)',
              color: filter === f.id ? 'var(--teal-dark)' : 'var(--slate)',
              fontWeight: filter === f.id ? 700 : 500,
              fontSize: '0.8rem', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              transition: 'all 0.15s'
            }}>
              {f.icon && <Icon name={f.icon} size={12} strokeWidth={1.8} />}
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
            textAlign: 'center', padding: '56px 20px',
            background: 'var(--white)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)'
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'var(--teal-pale)', color: 'var(--teal-dark)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 14
            }}>
              <Icon name="sprout" size={28} strokeWidth={1.6} />
            </div>
            <p style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '1rem', margin: '0 0 6px' }}>
              {filter === 'todas' ? '¡Aquí empezará tu camino!' : 'No hay objetivos aquí'}
            </p>
            <p style={{ color: 'var(--slate)', fontSize: '0.875rem', margin: '0 0 20px' }}>
              {filter === 'todas'
                ? 'Agrega tu primer objetivo o chatea con Contigo para recibir sugerencias personalizadas.'
                : 'Prueba cambiar el filtro.'}
            </p>
            {filter === 'todas' && (
              <button className="btn btn--primary" onClick={() => setShowForm(true)}>
                <Icon name="plus" size={14} /> Agregar primer objetivo
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
            marginTop: 24, textAlign: 'center', padding: '24px',
            background: 'var(--teal-pale)', borderRadius: 'var(--radius-lg)',
            border: '1.5px solid var(--teal-light)'
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'var(--white)', color: 'var(--teal-dark)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 10, boxShadow: 'var(--shadow-sm)'
            }}>
              <Icon name="sparkle" size={24} strokeWidth={1.6} />
            </div>
            <p style={{ fontWeight: 800, color: 'var(--teal-dark)', margin: '0 0 4px', fontSize: '1.1rem' }}>
              Completaste todos tus objetivos
            </p>
            <p style={{ color: 'var(--slate)', fontSize: '0.875rem', margin: 0 }}>
              Eso merece un momento de orgullo. Sigue así.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
