import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import axios from 'axios'

const AuthContext = createContext(null)

/**
 * Aplica (o quita) la cabecera de sesión de axios.
 *
 * Tiene que ser síncrono, no un efecto: React ejecuta los efectos de hijo
 * a padre, así que un panel recién montado lanzaba su primera petición
 * antes de que el efecto de este proveedor pusiera la cabecera. Esa
 * petición volvía 401 y el interceptor de abajo cerraba la sesión, con lo
 * que iniciar sesión desde el formulario devolvía a la pantalla de acceso.
 */
function aplicarCabecera(token) {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    delete axios.defaults.headers.common['Authorization']
  }
}

// Al cargar el módulo, antes del primer render, para que la sesión
// guardada valga desde la primera petición.
aplicarCabecera(localStorage.getItem('token'))

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [token, setToken]     = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  // Verify token on mount
  useEffect(() => {
    const verify = async () => {
      if (!token) { setLoading(false); return }
      try {
        const { data } = await axios.get('/api/auth/me')
        setUser(data.user)
      } catch {
        localStorage.removeItem('token')
        aplicarCabecera(null)
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
    aplicarCabecera(tokenStr)   // antes de que la vista de destino se monte
    setToken(tokenStr)
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    aplicarCabecera(null)
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
