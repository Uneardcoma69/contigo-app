// Vocabulario clínico compartido entre las vistas del equipo.
// Antes estaba duplicado en AdminPage, StaffPage y GoalsPage, con el
// riesgo de que un color o una etiqueta cambiara solo en una de ellas.

/**
 * Niveles de riesgo emocional detectados en el chat.
 *
 * Los colores salen de los tokens del sistema visual, no de valores
 * escritos aquí: así el nivel se ve igual en toda la aplicación y sigue
 * al tema si algún día se activa el modo oscuro. El punto de color ya no
 * es un emoji —se veía distinto en cada sistema—, sino una figura que
 * dibuja el propio distintivo.
 */
export const LEVEL_CONFIG = {
  alto:      { label: 'Alto',      color: 'var(--riesgo-alto)',  bg: 'var(--riesgo-alto-bg)',  border: 'var(--riesgo-alto-line)' },
  medio:     { label: 'Medio',     color: 'var(--riesgo-medio)', bg: 'var(--riesgo-medio-bg)', border: 'var(--riesgo-medio-line)' },
  bajo:      { label: 'Bajo',      color: 'var(--riesgo-bajo)',  bg: 'var(--riesgo-bajo-bg)',  border: 'var(--riesgo-bajo-line)' },
  sin_datos: { label: 'Sin datos', color: 'var(--riesgo-nulo)',  bg: 'var(--riesgo-nulo-bg)',  border: 'var(--riesgo-nulo-line)' },
}

/**
 * Estado de validación de la ficha médica, en el lenguaje del equipo.
 * El paciente ve otra redacción, más cercana y en segunda persona: esa
 * vive en GoalsPage y no debe unificarse con esta.
 */
export const MEDICAL_STATUS = {
  validada:  { label: 'Validada',  icono: 'check', color: 'var(--exito)', bg: 'var(--exito-bg)' },
  pendiente: { label: 'Pendiente', icono: 'circulo', color: 'var(--riesgo-medio)', bg: 'var(--riesgo-medio-bg)' },
  rechazada: { label: 'Rechazada', icono: 'cerrar', color: 'var(--riesgo-alto)', bg: 'var(--riesgo-alto-bg)' },
  sin_ficha: { label: 'Sin ficha', icono: 'ficha', color: 'var(--slate-light)', bg: 'var(--riesgo-nulo-bg)' },
}

/** Estado de una cita del calendario. */
export const APPT_STATUS = {
  programada: { label: 'Programada', color: 'var(--teal-dark)', bg: 'var(--teal-pale)' },
  completada: { label: 'Completada', color: 'var(--exito)', bg: 'var(--exito-bg)' },
  cancelada:  { label: 'Cancelada',  color: 'var(--slate-light)', bg: 'var(--riesgo-nulo-bg)' },
}

/**
 * Categorías de las metas del paciente.
 * Vivían repartidas entre GoalsPage (lista completa) y ChatPage (solo los
 * emojis), con el riesgo de que un emoji cambiara en una pantalla y no en
 * la otra para la misma categoría.
 */
export const CATEGORIES = [
  { id: 'general',   label: 'General',   icono: 'estrella', color: 'var(--cat-general)' },
  { id: 'bienestar', label: 'Bienestar', icono: 'hoja',     color: 'var(--cat-bienestar)' },
  { id: 'sueño',     label: 'Sueño',     icono: 'luna',     color: 'var(--cat-sueno)' },
  { id: 'ejercicio', label: 'Ejercicio', icono: 'pesa',     color: 'var(--cat-ejercicio)' },
  { id: 'mente',     label: 'Mente',     icono: 'mente',    color: 'var(--cat-mente)' },
  { id: 'social',    label: 'Social',    icono: 'personas', color: 'var(--cat-social)' },
]

/** Atajo para cuando solo hace falta el icono o el color de una categoría. */
export const CAT_ICONO = Object.fromEntries(CATEGORIES.map(c => [c.id, c.icono]))
export const CAT_COLOR = Object.fromEntries(CATEGORIES.map(c => [c.id, c.color]))

/** Nombre legible de cada rol. */
export const ROLE_LABEL = {
  psychologist: 'Psicólogo/a',
  monitor: 'Monitor/a',
  admin: 'Admin',
  user: 'Paciente',
}

/**
 * A dónde va cada rol después de iniciar sesión (o al visitar una página de
 * auth ya logueado). El paciente llega a su panel, no al chat: desde ahí ve
 * de un vistazo sus citas y sus objetivos, y entra al chat cuando lo decide.
 * Única fuente de verdad: vivía repetida (y con resultados distintos) en
 * Home, Login y Register.
 */
export function homeFor(user) {
  if (user?.isAdmin) return '/admin'
  if (user?.isStaff) return '/staff'
  return '/inicio'
}

/**
 * Rebaja un color del sistema a una lámina de fondo.
 *
 * Antes se le pegaba la transparencia al final del valor (`${color}30`),
 * un truco que solo funciona si el color es un hexadecimal literal. Al
 * pasar los colores a tokens eso producía CSS inválido y el fondo
 * desaparecía. `color-mix` hace lo mismo y sí acepta variables.
 */
export const tinte = (color, pct = 12) =>
  `color-mix(in srgb, ${color} ${pct}%, transparent)`
