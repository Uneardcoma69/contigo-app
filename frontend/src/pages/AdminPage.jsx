import { useState, useEffect, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext.jsx'
import Header from '../components/Header.jsx'
import ToastContainer from '../components/ToastContainer.jsx'
import RiskBadge from '../components/RiskBadge.jsx'
import { useToast } from '../hooks/useToast.js'
import { LEVEL_CONFIG } from '../constants.js'

function StatCard({ label, count, emoji, color, bg, border, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={{
      background: bg, border: `2px solid ${border}`,
      borderRadius: 'var(--radius-lg)', padding: '20px 24px',
      flex: '1 1 140px', minWidth: 140, transition: 'transform 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: '1.8rem' }}>{emoji}</span>
        <span style={{ fontSize: '2rem', fontWeight: 600, color }}>{count}</span>
      </div>
      <div style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--navy)' }}>{label}</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--slate)', fontWeight: 600 }}>{pct}% del total</div>
    </div>
  )
}

function HeatmapGrid({ users, onSelectUser }) {
  return (
    <div className="heatmap-grid">
      {users.map(u => {
        const cfg = LEVEL_CONFIG[u.risk.level] || LEVEL_CONFIG.sin_datos
        return (
          <button
            key={u._id}
            className={`heatmap-cell ${u.risk.level === 'alto' ? 'heatmap-cell--pulse' : ''}`}
            onClick={() => onSelectUser(u)}
            title={`${u.name} — ${cfg.label}`}
            style={{
              background: cfg.color,
              border: u.risk.level === 'alto' ? `2px solid ${cfg.color}` : '1px solid transparent',
            }}
          >
            <span className="heatmap-cell__initial">
              {u.name ? u.name[0].toUpperCase() : '?'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function UserDetailModal({ user, onClose }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get(`/api/admin/user/${user._id}`)
      .then(({ data }) => setDetail(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user._id])

  const cfg = LEVEL_CONFIG[user.risk.level] || LEVEL_CONFIG.sin_datos

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: cfg.bg, border: `1px solid ${cfg.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: cfg.color, fontWeight: 600, fontSize: '1.05rem'
            }}>
              {user.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: 'var(--navy)' }}>{user.name}</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--slate)' }}>{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: '1.5rem',
            cursor: 'pointer', color: 'var(--slate)', padding: 4
          }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <RiskBadge level={user.risk.level} />
          <span style={{ fontSize: '0.85rem', color: 'var(--slate)', fontWeight: 600, alignSelf: 'center' }}>
            Score: {user.risk.score} · {user.risk.alertCount} alertas registradas
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <span className="spinner spinner--dark" style={{ width: 24, height: 24 }} />
          </div>
        ) : detail ? (
          <>
            {/* Palabras clave detectadas */}
            {detail.risk?.triggerWords?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--navy)', marginBottom: 8 }}>
                  🔍 Palabras clave detectadas
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {detail.risk.triggerWords.map((w, i) => (
                    <span key={i} style={{
                      padding: '3px 10px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 500,
                      background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca'
                    }}>{w}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Historial de alertas */}
            {detail.risk?.alerts?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--navy)', marginBottom: 8 }}>
                  ⚠️ Historial de alertas ({detail.risk.alerts.length})
                </h3>
                <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {detail.risk.alerts.slice().reverse().map((a, i) => (
                    <div key={i} style={{
                      padding: '8px 12px', borderRadius: 10,
                      background: LEVEL_CONFIG[a.level]?.bg || '#f8fafc',
                      border: `1px solid ${LEVEL_CONFIG[a.level]?.border || '#e2e8f0'}`,
                      fontSize: '0.82rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <RiskBadge level={a.level} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>
                          {new Date(a.timestamp).toLocaleString('es')}
                        </span>
                      </div>
                      <p style={{ margin: 0, color: 'var(--navy)', fontWeight: 500 }}>
                        "{a.message?.slice(0, 120)}{a.message?.length > 120 ? '...' : ''}"
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mensajes recientes */}
            {detail.recentMessages?.length > 0 && (
              <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--navy)', marginBottom: 8 }}>
                  💬 Mensajes recientes
                </h3>
                <div style={{ maxHeight: 250, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {detail.recentMessages.map((m, i) => (
                    <div key={i} style={{
                      padding: '8px 12px', borderRadius: 10,
                      background: m.role === 'user' ? 'var(--teal-pale)' : 'var(--white)',
                      border: '1px solid var(--border)',
                      fontSize: '0.82rem'
                    }}>
                      <span style={{
                        fontWeight: 500, fontSize: '0.75rem',
                        color: m.role === 'user' ? 'var(--teal-dark)' : 'var(--slate)'
                      }}>
                        {m.role === 'user' ? '👤 Usuario' : '🤖 Contigo'}
                      </span>
                      <p style={{ margin: '4px 0 0', color: 'var(--navy)', fontWeight: 500 }}>
                        {m.content?.slice(0, 200)}{m.content?.length > 200 ? '...' : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p style={{ color: 'var(--slate)', textAlign: 'center' }}>No se pudieron cargar los detalles.</p>
        )}
      </div>
    </div>
  )
}

export default function AdminPage() {
  const { user } = useAuth()
  const { toasts, error: showError } = useToast()

  const [data, setData]             = useState(null)
  const [loading, setLoading]       = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const [autoRefresh, setAutoRefresh]   = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const { data: d } = await axios.get('/api/admin/dashboard')
      setData(d)
    } catch (err) {
      if (err?.response?.status === 403) {
        showError('No tienes permisos de administrador.')
      } else {
        showError('Error al cargar el dashboard.')
      }
    } finally {
      setLoading(false)
    }
  }, [showError])

  useEffect(() => {
    if (user) fetchData()
  }, [fetchData]) // eslint-disable-line

  // Auto-refresh cada 15 segundos
  useEffect(() => {
    if (!user || !autoRefresh) return
    const interval = setInterval(fetchData, 15000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchData]) // eslint-disable-line

  // Importante: el return condicional va DESPUÉS de todos los hooks
  if (!user) return <Navigate to="/login" replace />

  if (loading) {
    return (
      <div className="app-layout">
        <Header />
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <span className="spinner spinner--dark" style={{ width: 32, height: 32 }} />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="app-layout">
        <Header />
        <div style={{ textAlign: 'center', padding: 80 }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔒</div>
          <p style={{ fontWeight: 500, color: 'var(--navy)' }}>Acceso denegado</p>
          <p style={{ color: 'var(--slate)', fontSize: '0.9rem' }}>Solo el administrador puede ver este panel.</p>
        </div>
      </div>
    )
  }

  const { stats, users: allUsers } = data

  return (
    <div className="app-layout" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Background */}
      <div className="anim-pulse" style={{
        position: 'fixed', top: '-15%', right: '-10%', width: '50vw', height: '50vw',
        background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 60%)',
        borderRadius: '50%', zIndex: 0
      }} />

      <Header />
      <ToastContainer toasts={toasts} />

      <main className="admin-dashboard" style={{ position: 'relative', zIndex: 1 }}>
        {/* Título */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--navy)', margin: 0, letterSpacing: '-0.03em' }}>
              🛡️ Panel de Alertas
            </h1>
            <p style={{ color: 'var(--slate)', fontSize: '0.875rem', margin: '4px 0 0' }}>
              Monitoreo de bienestar emocional de usuarios
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className={`btn btn--sm ${autoRefresh ? 'btn--primary' : 'btn--outline'}`}
              onClick={() => setAutoRefresh(r => !r)}
              style={{ fontSize: '0.82rem' }}
            >
              {autoRefresh ? '⏸ Auto-refresh ON' : '▶ Auto-refresh OFF'}
            </button>
            <button className="btn btn--outline btn--sm" onClick={fetchData} style={{ fontSize: '0.82rem' }}>
              🔄 Refrescar
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
          <StatCard {...LEVEL_CONFIG.alto} count={stats.alto} total={stats.total} />
          <StatCard {...LEVEL_CONFIG.medio} count={stats.medio} total={stats.total} />
          <StatCard {...LEVEL_CONFIG.bajo} count={stats.bajo} total={stats.total} />
          <StatCard {...LEVEL_CONFIG.sin_datos} count={stats.sinDatos} total={stats.total} />
        </div>

        {/* Mapa de Calor */}
        <div style={{
          background: 'var(--white)', borderRadius: 'var(--radius-lg)',
          padding: '24px', marginBottom: 28, boxShadow: 'var(--shadow-md)',
          border: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--navy)' }}>
              🗺️ Mapa de Calor
            </h2>
            <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: 'var(--slate)', fontWeight: 600 }}>
              <span>🔴 Alto</span>
              <span>🟡 Medio</span>
              <span>🟢 Bajo</span>
              <span>⚪ Sin datos</span>
            </div>
          </div>

          {allUsers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--slate)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>👥</div>
              <p style={{ fontWeight: 600 }}>No hay usuarios registrados aún</p>
            </div>
          ) : (
            <HeatmapGrid users={allUsers} onSelectUser={setSelectedUser} />
          )}
        </div>

        {/* Tabla de prioridad */}
        <div style={{
          background: 'var(--white)', borderRadius: 'var(--radius-lg)',
          padding: '24px', boxShadow: 'var(--shadow-md)',
          border: '1px solid var(--border)', overflowX: 'auto'
        }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: 600, color: 'var(--navy)' }}>
            📋 Lista de Prioridad
          </h2>

          {allUsers.length === 0 ? (
            <p style={{ color: 'var(--slate)', textAlign: 'center', padding: 20 }}>Sin usuarios registrados.</p>
          ) : (
            <table className="alert-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Nivel</th>
                  <th>Score</th>
                  <th>Alertas</th>
                  <th>Último mensaje</th>
                  <th>Última vez</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map(u => (
                  <tr key={u._id} className={u.risk.level === 'alto' ? 'alert-table__row--danger' : ''}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: `${LEVEL_CONFIG[u.risk.level]?.color || '#94a3b8'}20`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.8rem', fontWeight: 600, color: 'var(--navy)', flexShrink: 0
                        }}>
                          {u.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: '0.88rem' }}>{u.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><RiskBadge level={u.risk.level} /></td>
                    <td style={{ fontWeight: 600, color: LEVEL_CONFIG[u.risk.level]?.color || 'var(--slate)' }}>
                      {u.risk.score}
                    </td>
                    <td style={{ fontWeight: 500 }}>{u.risk.alertCount}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--slate)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.risk.lastMessage ? `"${u.risk.lastMessage.slice(0, 60)}${u.risk.lastMessage.length > 60 ? '...' : ''}"` : '—'}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--slate)', whiteSpace: 'nowrap' }}>
                      {u.risk.lastAnalysis ? new Date(u.risk.lastAnalysis).toLocaleString('es', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : '—'}
                    </td>
                    <td>
                      <button
                        className="btn btn--outline btn--sm"
                        style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                        onClick={() => setSelectedUser(u)}
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Modal de detalle */}
      {selectedUser && (
        <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  )
}
