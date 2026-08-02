import requireRole from './requireRole.js'

/**
 * Middleware que verifica que el usuario sea administrador.
 * Acepta usuarios con role 'admin' o cuyo email sea ADMIN_EMAIL.
 */
export default requireRole('admin')
