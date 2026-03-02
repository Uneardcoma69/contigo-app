import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import AuthForm from '../components/AuthForm.jsx'
import Header from '../components/Header.jsx'

export default function Register() {
  const { user } = useAuth()
  const nav = useNavigate()

  if (user) return <Navigate to="/chat" replace />

  return (
    <div className="app-layout">
      <Header />
      <main className="auth-page">
        <div className="auth-card">
          <div className="auth-card__header">
            <span className="auth-card__icon">✨</span>
            <h1 className="auth-card__title">Crea tu cuenta</h1>
            <p className="auth-card__subtitle">
              Comienza tu camino hacia el bienestar
            </p>
          </div>

          <AuthForm
            mode="register"
            onSuccess={() => nav('/chat')}
          />
        </div>
      </main>
    </div>
  )
}
