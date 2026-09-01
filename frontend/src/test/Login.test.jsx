import { describe, it, expect, beforeEach } from 'vitest'
import Login from '../pages/Login.jsx'
import { renderConProviders, screen } from './testUtils.jsx'

describe('Login page', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renderiza el formulario cuando no hay sesión', () => {
    renderConProviders(<Login />, { ruta: '/login' })
    expect(screen.getByRole('heading', { name: /bienvenida de vuelta/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument()
  })

  it('el link de "olvidaste tu contraseña" lleva a /recuperar-contrasena', () => {
    renderConProviders(<Login />, { ruta: '/login' })
    expect(screen.getByRole('link', { name: /olvidaste tu contraseña/i })).toHaveAttribute('href', '/recuperar-contrasena')
  })
})
