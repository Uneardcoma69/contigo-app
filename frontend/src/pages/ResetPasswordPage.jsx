import { useState } from 'react'
import { Navigate, Link, useSearchParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext.jsx'
import Header from '../components/Header.jsx'
import { homeFor } from '../constants.js'

export default function ResetPasswordPage() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const token = params.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to={homeFor(user)} replace />

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    try {
      await axios.put('/api/auth/reset-password', { token, newPassword: password })
      nav('/login', { state: { restablecida: true } })
    } catch (err) {
      setError(err?.response?.data?.message || 'No pudimos restablecer la contraseña. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-split">
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <Header />
        <main className="auth-page" style={{ position: 'relative', zIndex: 1 }}>
          <div className="auth-card">
            <div className="auth-card__header">
              <img
                className="auth-card__marca"
                src="/marca/contigo-horizontal.png"
                alt="Contigo — Aquí Estoy"
                width="400"
                height="175"
              />
              <h1 className="auth-card__title">Crear nueva contraseña</h1>
              <p className="auth-card__subtitle">
                Elegí una contraseña que no hayas usado antes
              </p>
            </div>

            {!token ? (
              <div className="alert alert--error" role="alert">
                <span>Este enlace no trae el código de recuperación. Pedí uno nuevo.</span>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <div className="form-group">
                  <label className="form-label" htmlFor="password">
                    Nueva contraseña
                    <span style={{ fontWeight: 400, color: 'var(--slate-light)', marginLeft: 6 }}>(mínimo 6 caracteres)</span>
                  </label>
                  <input
                    id="password"
                    className="form-input"
                    type="password"
                    placeholder="Crea una contraseña segura"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={6}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="confirmar">Confirmar contraseña</label>
                  <input
                    id="confirmar"
                    className="form-input"
                    type="password"
                    placeholder="Repetí la contraseña"
                    value={confirmar}
                    onChange={e => setConfirmar(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={6}
                  />
                </div>

                {error && (
                  <div className="alert alert--error" role="alert" style={{ marginBottom: 16 }}>
                    <span>{error}</span>
                  </div>
                )}

                <button type="submit" className="btn btn--primary btn--full btn--lg" disabled={loading}>
                  {loading ? <><span className="spinner" style={{ width: 18, height: 18 }} /> Guardando...</> : 'Guardar contraseña'}
                </button>
              </form>
            )}

            <div className="auth-card__footer" style={{ marginTop: 20 }}>
              {!token && <>¿Se venció el enlace? </>}
              <Link to="/recuperar-contrasena">Pedir un enlace nuevo</Link>
              {' · '}
              <Link to="/login">Iniciar sesión</Link>
            </div>
          </div>
        </main>
      </div>

      <aside className="auth-split__panel" aria-hidden="true">
        <blockquote className="auth-split__quote">
          <p>«Las sesiones en línea me permitieron ser constante por primera vez. El seguimiento entre citas marca la diferencia.»</p>
          <footer>Jorge R. · manejo de ansiedad</footer>
        </blockquote>
      </aside>
    </div>
  )
}
