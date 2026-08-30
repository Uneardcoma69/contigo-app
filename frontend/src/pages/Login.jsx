import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import AuthForm from '../components/AuthForm.jsx'
import Header from '../components/Header.jsx'
import { homeFor } from '../constants.js'

export default function Login() {
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
              <h1 className="auth-card__title">Bienvenida de vuelta</h1>
              <p className="auth-card__subtitle">
                Tu espacio sigue donde lo dejaste
              </p>
            </div>

            <AuthForm
              mode="login"
              onSuccess={(loggedUser) => nav(homeFor(loggedUser))}
            />

            <p style={{
              marginTop: 16, textAlign: 'center', fontSize: '0.82rem',
              color: 'var(--slate)', lineHeight: 1.5
            }}>
              ¿Olvidaste tu contraseña? Escríbenos a{' '}
              <a href="mailto:hola@contigoaquiestoy.com" style={{ color: 'var(--teal-dark)', fontWeight: 500 }}>
                hola@contigoaquiestoy.com
              </a>{' '}
              y te ayudamos a restablecerla.
            </p>
          </div>
        </main>
      </div>

      <aside className="auth-split__panel" aria-hidden="true">
        <blockquote className="auth-split__quote">
          <p>«Llegué sin saber cómo nombrar lo que me pasaba. Hoy tengo herramientas y, sobre todo, me siento escuchada.»</p>
          <footer>Mariana G. · proceso individual</footer>
        </blockquote>
      </aside>
    </div>
  )
}
