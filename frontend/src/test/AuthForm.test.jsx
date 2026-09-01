import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import axios from 'axios'
import AuthForm from '../components/AuthForm.jsx'
import { renderConProviders, screen } from './testUtils.jsx'

vi.mock('axios')

describe('AuthForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('modo login no muestra el campo de nombre', () => {
    renderConProviders(<AuthForm mode="login" />)
    expect(screen.queryByLabelText(/tu nombre/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument()
  })

  it('modo registro sí muestra el campo de nombre', () => {
    renderConProviders(<AuthForm mode="register" />)
    expect(screen.getByLabelText(/tu nombre/i)).toBeInTheDocument()
  })

  it('el submit en modo login llama a axios.post con la ruta y el body correctos', async () => {
    axios.post.mockResolvedValue({ data: { token: 'abc', user: { id: '1', name: 'Test' } } })
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    renderConProviders(<AuthForm mode="login" onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/correo electrónico/i), 'test@test.com')
    await user.type(screen.getByLabelText(/contraseña/i), 'clave123')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(axios.post).toHaveBeenCalledWith('/api/auth/login', { email: 'test@test.com', password: 'clave123' })
    expect(onSuccess).toHaveBeenCalledWith({ id: '1', name: 'Test' })
  })

  it('muestra el error que devuelve el backend', async () => {
    axios.post.mockRejectedValue({ response: { data: { message: 'Correo o contraseña incorrectos.' } } })
    const user = userEvent.setup()
    renderConProviders(<AuthForm mode="login" />)

    await user.type(screen.getByLabelText(/correo electrónico/i), 'test@test.com')
    await user.type(screen.getByLabelText(/contraseña/i), 'malaclave')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeInTheDocument()
  })
})
