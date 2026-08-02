import jwt from 'jsonwebtoken'
import { findUserById } from '../store.js'

/**
 * Devuelve el rol efectivo de un usuario.
 * Compatibilidad: el usuario cuyo email coincide con ADMIN_EMAIL
 * es admin aunque su campo role diga otra cosa.
 */
export function effectiveRole(user) {
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim()
  if (adminEmail && user.email === adminEmail) return 'admin'
  return user.role || 'user'
}

/**
 * Factory de middleware por rol.
 * Uso: requireRole('admin')  ·  requireRole('psychologist', 'monitor', 'admin')
 * Valida el JWT, carga el usuario y verifica que su rol esté permitido.
 */
export default function requireRole(...allowedRoles) {
  return function (req, res, next) {
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null

    if (!token) {
      return res.status(401).json({ message: 'Sesión requerida.' })
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET)
      const user = findUserById(payload.id)

      if (!user) {
        return res.status(401).json({ message: 'Usuario no encontrado.' })
      }

      const role = effectiveRole(user)
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({ message: 'Acceso denegado. No tienes permisos suficientes.' })
      }

      req.userId = payload.id
      req.user = user
      req.userRole = role
      next()
    } catch (err) {
      const msg = err.name === 'TokenExpiredError'
        ? 'Tu sesión expiró. Vuelve a iniciar sesión.'
        : 'Token inválido.'
      return res.status(401).json({ message: msg })
    }
  }
}

/** Staff = monitor, psicólogo o admin */
export const requireStaff = requireRole('monitor', 'psychologist', 'admin')
