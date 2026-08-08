// Vocabulario clínico compartido entre las vistas del equipo.
// Antes estaba duplicado en AdminPage, StaffPage y GoalsPage, con el
// riesgo de que un color o una etiqueta cambiara solo en una de ellas.

/** Niveles de riesgo emocional detectados en el chat. */
export const LEVEL_CONFIG = {
  alto:      { label: 'Alto',      emoji: '🔴', color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  medio:     { label: 'Medio',     emoji: '🟡', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  bajo:      { label: 'Bajo',      emoji: '🟢', color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0' },
  sin_datos: { label: 'Sin datos', emoji: '⚪', color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0' },
}

/**
 * Estado de validación de la ficha médica, en el lenguaje del equipo.
 * El paciente ve otra redacción, más cercana y en segunda persona: esa
 * vive en GoalsPage y no debe unificarse con esta.
 */
export const MEDICAL_STATUS = {
  validada:  { label: 'Validada',  emoji: '✅', color: '#16a34a', bg: '#f0fdf4' },
  pendiente: { label: 'Pendiente', emoji: '⏳', color: '#f59e0b', bg: '#fffbeb' },
  rechazada: { label: 'Rechazada', emoji: '❌', color: '#ef4444', bg: '#fef2f2' },
  sin_ficha: { label: 'Sin ficha', emoji: '📄', color: '#94a3b8', bg: '#f8fafc' },
}

/** Estado de una cita del calendario. */
export const APPT_STATUS = {
  programada: { label: 'Programada', color: 'var(--teal-dark)', bg: 'var(--teal-pale)' },
  completada: { label: 'Completada', color: '#16a34a', bg: '#f0fdf4' },
  cancelada:  { label: 'Cancelada',  color: '#94a3b8', bg: '#f8fafc' },
}

/** Nombre legible de cada rol. */
export const ROLE_LABEL = {
  psychologist: 'Psicólogo/a',
  monitor: 'Monitor/a',
  admin: 'Admin',
  user: 'Paciente',
}
