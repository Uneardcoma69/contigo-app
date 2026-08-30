import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import AuthForm from '../components/AuthForm.jsx'
import Header from '../components/Header.jsx'
import { homeFor } from '../constants.js'

export default function Register() {
  const { user } = useAuth()
  const nav = useNavigate()

  if (user) return <Navigate to={homeFor(user)} replace />

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
              <h1 className="auth-card__title">Crea tu cuenta</h1>
              <p className="auth-card__subtitle">
                Comienza tu camino hacia el bienestar
              </p>
            </div>

            <AuthForm
              mode="register"
              onSuccess={() => nav('/inicio')}
            />
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
