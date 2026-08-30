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
    <div className="app-layout" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Background Blobs for Auth Pages */}
      <div className="anim-pulse" style={{
        position: 'absolute', top: '-10%', right: '-10%', width: '50vw', height: '50vw',
        background: 'radial-gradient(circle, var(--teal-pale) 0%, transparent 70%)',
        borderRadius: '50%', zIndex: 0, opacity: 0.8
      }} />
      <div className="anim-float" style={{
        position: 'absolute', bottom: '-20%', left: '-10%', width: '60vw', height: '60vw',
        background: 'radial-gradient(circle, var(--sage-light) 0%, transparent 60%)',
        borderRadius: '50%', zIndex: 0, opacity: 0.4
      }} />

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
  )
}
