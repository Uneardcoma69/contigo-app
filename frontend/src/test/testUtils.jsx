import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext.jsx'

/**
 * Envuelve en MemoryRouter + AuthProvider, que es lo que casi cualquier
 * componente de la app necesita para renderizar sin explotar (usan
 * useAuth()/Link/Navigate). Repetirlo en cada archivo de test no aporta
 * nada, así que vive acá una sola vez.
 */
export function renderConProviders(ui, { ruta = '/', ...opciones } = {}) {
  return render(ui, {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={[ruta]}>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    ),
    ...opciones
  })
}

export * from '@testing-library/react'
