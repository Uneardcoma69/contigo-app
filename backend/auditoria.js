import { recordAudit } from './store.js'

/**
 * Deja constancia de una acción sobre información clínica.
 *
 * Toma los datos de quien actúa del propio `req`, que ya vienen puestos
 * por `requireRole`. Nunca lanza: si el registro fallara, la operación
 * que el profesional está haciendo debe continuar igual, y el problema
 * queda en la consola del servidor.
 */
export function auditar(req, action, { targetId, targetName, details } = {}) {
  try {
    recordAudit({
      actorId: req.userId,
      actorName: req.user?.name,
      actorRole: req.userRole || req.user?.role,
      action,
      targetId,
      targetName,
      details
    })
  } catch (e) {
    console.error('⚠️ No se pudo registrar en la auditoría:', e.message)
  }
}
