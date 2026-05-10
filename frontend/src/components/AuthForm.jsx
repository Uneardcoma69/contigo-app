import { useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from './Icon.jsx'

export default function AuthForm({ mode = 'login', onSuccess, onError }) {
  const isLogin = mode === 'login'
  const { login } = useAuth()

  const [form, setForm]       = useState({ name: '', email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isLogin) {
        const { data } = await axios.post('/api/auth/login', {
          email: form.email,
          password: form.password
        })
        login(data.token, data.user)
        onSuccess?.()
      } else {
        const { data } = await axios.post('/api/auth/register', {
          name: form.name.trim(),
          email: form.email,
          password: form.password
        })
        // Auto-login after register
        login(data.token, data.user)
        onSuccess?.()
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Algo salió mal. Inténtalo de nuevo.'
      setError(msg)
      onError?.(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      {error && (
        <div className="alert alert--error" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      {!isLogin && (
        <div className="form-group">
          <label className="form-label" htmlFor="name">Tu nombre</label>
          <input
            id="name"
            className="form-input"
            type="text"
            placeholder="Ej. María García"
            value={form.name}
            onChange={set('name')}
            autoComplete="name"
            required
            minLength={2}
          />
        </div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="email">Correo electrónico</label>
        <input
          id="email"
          className="form-input"
          type="email"
          placeholder="tu@correo.com"
          value={form.email}
          onChange={set('email')}
          autoComplete={isLogin ? 'email' : 'new-email'}
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="password">
          Contraseña
          {!isLogin && <span style={{ fontWeight: 400, color: 'var(--slate-light)', marginLeft: 6 }}>(mínimo 6 caracteres)</span>}
        </label>
        <input
          id="password"
          className="form-input"
          type="password"
          placeholder={isLogin ? '••••••••' : 'Crea una contraseña segura'}
          value={form.password}
          onChange={set('password')}
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          required
          minLength={6}
        />
      </div>

      <button
        type="submit"
        className="btn btn--primary btn--full btn--lg"
        disabled={loading}
        style={{ marginTop: 4 }}
      >
        {loading
          ? <><span className="spinner" style={{ width: 18, height: 18 }} /> {isLogin ? 'Entrando...' : 'Creando cuenta...'}</>
          : isLogin ? 'Entrar' : 'Crear mi cuenta'
        }
      </button>

      <div className="auth-card__footer" style={{ marginTop: 20 }}>
        {isLogin
          ? <>¿No tienes cuenta? <Link to="/register">Regístrate gratis</Link></>
          : <>¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></>
        }
      </div>
    </form>
  )
}
