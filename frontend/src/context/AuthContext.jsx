import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import axios from 'axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [token, setToken]     = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  // Set axios default header
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    } else {
      delete axios.defaults.headers.common['Authorization']
    }
  }, [token])

  // Verify token on mount
  useEffect(() => {
    const verify = async () => {
      if (!token) { setLoading(false); return }
      try {
        const { data } = await axios.get('/api/auth/me')
        setUser(data.user)
      } catch {
        localStorage.removeItem('token')
        setToken(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }
    verify()
  }, []) // eslint-disable-line

  const login = useCallback((tokenStr, userData) => {
    localStorage.setItem('token', tokenStr)
    setToken(tokenStr)
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }, [])

  // Si el token deja de valer (expiró o la contraseña cambió en otra
  // sesión), cerramos sesión en vez de dejar la interfaz en un estado roto.
  useEffect(() => {
    const id = axios.interceptors.response.use(
      res => res,
      err => {
        const status = err?.response?.status
        const url = err?.config?.url || ''
        // El 401 de un intento de inicio de sesión fallido lo maneja el formulario
        const esIntentoDeLogin = url.includes('/auth/login')
        if (status === 401 && !esIntentoDeLogin && localStorage.getItem('token')) {
          logout()
        }
        return Promise.reject(err)
      }
    )
    return () => axios.interceptors.response.eject(id)
  }, [logout])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
