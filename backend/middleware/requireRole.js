import { verificarSesion } from './session.js'

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
    try {
      const { userId, user } = verificarSesion(req)
      const role = effectiveRole(user)
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({ message: 'Acceso denegado. No tienes permisos suficientes.' })
      }

      req.userId = userId
      req.user = user
      req.userRole = role
      next()
    } catch (err) {
      return res.status(err.status || 401).json({ message: err.message })
    }
  }
}

/** Staff = monitor, psicólogo o admin */
export const requireStaff = requireRole('monitor', 'psychologist', 'admin')

/**
 * Acciones clínicas: validar fichas médicas y gestionar citas.
 * El monitor es un rol de observación (ve pacientes, chats, alertas y
 * puede dejar notas), pero no toma decisiones clínicas.
 */
export const requireClinician = requireRole('psychologist', 'admin')
