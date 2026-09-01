import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext.jsx'
import Header from '../components/Header.jsx'
import { homeFor } from '../constants.js'

export default function ForgotPasswordPage() {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to={homeFor(user)} replace />

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await axios.post('/api/auth/forgot-password', { email })
      // El mensaje es el mismo exista o no la cuenta: el backend nunca
      // distingue, así que la pantalla tampoco puede hacerlo.
      setEnviado(true)
    } catch (err) {
      setError(err?.response?.data?.message || 'No pudimos procesar el pedido. Inténtalo de nuevo.')
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
              <h1 className="auth-card__title">Recuperar contraseña</h1>
              <p className="auth-card__subtitle">
                Te mandamos un enlace para crear una nueva
              </p>
            </div>

            {enviado ? (
              <div className="alert" role="status" style={{ background: 'var(--teal-pale)', color: 'var(--teal-dark)', border: '1px solid var(--teal-light)' }}>
                <span>
                  Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.
                  Revisá tu bandeja de entrada (y la de spam) — vale por 1 hora.
                </span>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <div className="form-group">
                  <label className="form-label" htmlFor="email">Correo electrónico</label>
                  <input
                    id="email"
                    className="form-input"
                    type="email"
                    placeholder="tu@correo.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>

                {error && (
                  <div className="alert alert--error" role="alert" style={{ marginBottom: 16 }}>
                    <span>{error}</span>
                  </div>
                )}

                <button type="submit" className="btn btn--primary btn--full btn--lg" disabled={loading}>
                  {loading ? <><span className="spinner" style={{ width: 18, height: 18 }} /> Enviando...</> : 'Enviar enlace'}
                </button>
              </form>
            )}

            <div className="auth-card__footer" style={{ marginTop: 20 }}>
              <Link to="/login">← Volver a iniciar sesión</Link>
            </div>
          </div>
        </main>
      </div>

      <aside className="auth-split__panel" aria-hidden="true">
        <blockquote className="auth-split__quote">
          <p>«Nos ayudaron a hablar de temas que llevábamos años evitando, con respeto y sin tomar partido.»</p>
          <footer>Claudia y Andrés · terapia de pareja</footer>
        </blockquote>
      </aside>
    </div>
  )
}
