import jwt from 'jsonwebtoken'
import { findUserById } from '../store.js'

/** Error con el status HTTP ya resuelto, listo para que el middleware lo use tal cual. */
class SessionError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/**
 * Extrae y valida el Bearer token: verifica el JWT, carga el usuario y
 * confirma que la sesión no quedó invalidada por un cambio de contraseña.
 * Antes esta lógica estaba duplicada entera en requireAuth y requireRole —
 * un cambio de seguridad futuro (p. ej. fijar `algorithms` en jwt.verify)
 * podía aplicarse a uno y olvidarse en el otro.
 *
 * Lanza SessionError si algo falla; quien llama solo debe convertirlo en
 * la respuesta HTTP (status + message ya vienen resueltos).
 */
export function verificarSesion(req) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) throw new SessionError(401, 'Sesión requerida. Por favor inicia sesión.')

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = findUserById(payload.id)
    if (!user) throw new SessionError(401, 'Usuario no encontrado.')

    // Tokens antiguos (sin "v") se tratan como versión 0 por compatibilidad.
    if ((payload.v ?? 0) !== (user.tokenVersion ?? 0))
      throw new SessionError(401, 'Tu contraseña cambió. Vuelve a iniciar sesión.')

    return { userId: payload.id, user }
  } catch (err) {
    if (err instanceof SessionError) throw err
    const msg = err.name === 'TokenExpiredError'
      ? 'Tu sesión expiró. Vuelve a iniciar sesión.'
      : 'Token inválido. Por favor inicia sesión de nuevo.'
    throw new SessionError(401, msg)
  }
}
