import { useState } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext.jsx'

/**
 * Cambio de contraseña de la propia cuenta.
 * Al guardar, el backend devuelve un token nuevo (las demás sesiones
 * abiertas se cierran) y lo aplicamos para no perder la sesión actual.
 */
export default function ChangePasswordCard({ notifySuccess, notifyError }) {
  const { login, user } = useAuth()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ actual: '', nueva: '', repetir: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')

    if (form.nueva.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (form.nueva !== form.repetir) {
      setError('Las contraseñas nuevas no coinciden.')
      return
    }

    setSaving(true)
    try {
      const { data } = await axios.put('/api/auth/password', {
        currentPassword: form.actual,
        newPassword: form.nueva
      })
      login(data.token, data.user)   // renueva la sesión actual
      setForm({ actual: '', nueva: '', repetir: '' })
      setOpen(false)
      notifySuccess?.('Contraseña actualizada. Las demás sesiones se cerraron. 🔐')
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo cambiar la contraseña.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      marginTop: 32, background: 'var(--white)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: 24, boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--navy)' }}>🔐 Mi cuenta</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--slate)' }}>
            {user?.name} · {user?.email}
          </p>
        </div>
        <button className="btn btn--outline btn--sm" onClick={() => { setOpen(o => !o); setError('') }}>
          {open ? 'Cancelar' : 'Cambiar contraseña'}
        </button>
      </div>

      {open && (
        <form onSubmit={submit} style={{ marginTop: 18, display: 'grid', gap: 12, maxWidth: 420 }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 4 }}>
              Contraseña actual
            </label>
            <input
              type="password" className="form-input" style={{ padding: '10px 14px', fontSize: '0.9rem' }}
              value={form.actual} onChange={set('actual')} autoComplete="current-password" required
            />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 4 }}>
              Nueva contraseña <span style={{ fontWeight: 400, color: 'var(--slate-light)' }}>(mínimo 6 caracteres)</span>
            </label>
            <input
              type="password" className="form-input" style={{ padding: '10px 14px', fontSize: '0.9rem' }}
              value={form.nueva} onChange={set('nueva')} autoComplete="new-password" required minLength={6}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 4 }}>
              Repite la nueva contraseña
            </label>
            <input
              type="password" className="form-input" style={{ padding: '10px 14px', fontSize: '0.9rem' }}
              value={form.repetir} onChange={set('repetir')} autoComplete="new-password" required
            />
          </div>

          {error && (
            <p style={{
              margin: 0, padding: '10px 14px', borderRadius: 12, fontSize: '0.85rem', fontWeight: 600,
              background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c'
            }}>{error}</p>
          )}

          <button type="submit" className="btn btn--primary btn--sm" disabled={saving} style={{ justifySelf: 'start' }}>
            {saving ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>
      )}
    </div>
  )
}
