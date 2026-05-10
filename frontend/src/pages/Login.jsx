import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import AuthForm from '../components/AuthForm.jsx'
import Header from '../components/Header.jsx'
import Icon from '../components/Icon.jsx'

export default function Login() {
  const { user } = useAuth()
  const nav = useNavigate()

  if (user) return <Navigate to="/chat" replace />

  return (
    <div className="app-layout">
      <Header />
      <main className="auth-page">
        <div className="auth-card">
          <div className="auth-card__header">
            <div className="auth-card__icon-wrap">
              <Icon name="leaf" size={26} color="var(--teal-dark)" strokeWidth={1.6} />
            </div>
            <h1 className="auth-card__title">Bienvenido/a de vuelta</h1>
            <p className="auth-card__subtitle">
              Tu espacio de bienestar te espera
            </p>
          </div>

          <AuthForm
            mode="login"
            onSuccess={() => nav('/chat')}
          />
        </div>
      </main>
    </div>
  )
}
