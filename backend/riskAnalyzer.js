// ─── Motor de Análisis de Riesgo ────────────────────────────────
// Detecta señales de peligro emocional en mensajes de usuarios.
// Clasificación: BAJO (verde), MEDIO (amarillo), ALTO (rojo).
// Basado en palabras clave — no reemplaza evaluación profesional.

// ── Diccionarios de palabras clave por severidad ──────────────

// ALTO (score 10) — Riesgo inmediato: suicidio, autolesión, ideación de muerte
const HIGH_KEYWORDS = [
  // Suicidio / ideación suicida
  'suicidarme', 'suicidio', 'suicidar', 'quitarme la vida', 'acabar con mi vida',
  'acabar con todo', 'terminar con todo', 'no quiero vivir', 'no quiero seguir viviendo',
  'quiero morirme', 'quiero morir', 'me quiero morir', 'mejor muerto', 'mejor muerta',
  'mejor estaria muerto', 'mejor estaria muerta', 'desearía estar muerto', 'desearía estar muerta',
  'ojalá estuviera muerto', 'ojalá estuviera muerta', 'ojalá me muriera',
  'no vale la pena vivir', 'la vida no tiene sentido', 'la vida no vale la pena',
  'ya no quiero estar aquí', 'ya no quiero existir', 'dejar de existir',
  
  // Autolesión
  'cortarme', 'hacerme daño', 'lastimarme', 'herirme', 'autolesion',
  'me corto', 'me hago daño', 'me lastimo', 'me hiero',
  'quiero hacerme daño', 'ganas de cortarme', 'ganas de hacerme daño',
  
  // Despedida / planes concretos
  'carta de despedida', 'despedirme de todos', 'me voy para siempre',
  'ya tomé la decisión', 'ya lo decidí', 'no hay vuelta atrás',
  'tengo un plan', 'sé cómo hacerlo', 'esta noche', 'pastillas para morir',
  'tirarme', 'lanzarme', 'colgarme', 'ahorcarme', 'envenenarme',
]

// MEDIO (score 5) — Señales de alerta: desesperanza, depresión profunda, aislamiento
const MEDIUM_KEYWORDS = [
  // Desesperanza profunda
  'no puedo más', 'no aguanto más', 'ya no puedo', 'estoy harto de vivir',
  'no tiene sentido', 'nada tiene sentido', 'todo es inútil',
  'no hay salida', 'no hay esperanza', 'sin esperanza', 'sin salida',
  'nunca va a mejorar', 'nunca mejorará', 'esto no va a cambiar',
  'nadie me quiere', 'nadie me necesita', 'a nadie le importo',
  'soy una carga', 'estorbo', 'todos estarían mejor sin mí',
  
  // Depresión severa
  'depresión', 'deprimido', 'deprimida', 'profundamente triste',
  'vacío por dentro', 'me siento vacío', 'me siento vacía',
  'oscuridad', 'en un hoyo', 'en un abismo', 'hundido', 'hundida',
  'no siento nada', 'anestesiado', 'ya no siento',
  
  // Aislamiento extremo
  'completamente solo', 'completamente sola', 'nadie entiende',
  'no tengo a nadie', 'estoy solo en esto', 'abandonado', 'abandonada',
  'me alejé de todos', 'no quiero ver a nadie',
  
  // Abuso / situaciones graves
  'me golpean', 'me pegan', 'abuso', 'me maltratan', 'violencia',
  'me obligan', 'me amenazan', 'tengo miedo de', 'me hacen daño',
]

// BAJO (score 1) — Malestar general: tristeza, ansiedad, estrés cotidiano
const LOW_KEYWORDS = [
  'triste', 'tristeza', 'ansioso', 'ansiosa', 'ansiedad',
  'estrés', 'estresado', 'estresada', 'agotado', 'agotada',
  'cansado', 'cansada', 'agobiado', 'agobiada', 'preocupado', 'preocupada',
  'no puedo dormir', 'insomnio', 'pesadillas', 'mal humor',
  'frustrado', 'frustrada', 'enojado', 'enojada', 'irritable',
  'llorando', 'lloré', 'lloro mucho', 'ganas de llorar',
  'me siento mal', 'no me siento bien', 'día difícil', 'semana difícil',
  'nervioso', 'nerviosa', 'intranquilo', 'intranquila',
  'soledad', 'me siento solo', 'me siento sola',
  'desmotivado', 'desmotivada', 'sin energía', 'sin ganas',
  'abrumado', 'abrumada', 'sobrepasado', 'sobrepasada',
]

// Tope de lo que pueden sumar entre todas las palabras de malestar
// cotidiano. Sin \u00e9l, cuatro t\u00e9rminos leves en una misma frase \u2014"triste,
// ansioso, cansado y agobiado"\u2014 sumaban 4 y cruzaban el umbral de riesgo
// medio sin que hubiera ni una se\u00f1al de gravedad. El equipo recib\u00eda una
// alerta amarilla por un mal d\u00eda corriente, y una alerta que se aprende a
// ignorar deja de proteger a quien s\u00ed est\u00e1 en peligro.
//
// Con el tope en 3, hace falta al menos una palabra de severidad media
// (que vale 5) para llegar a "medio". Los dem\u00e1s umbrales no cambian.
const MAX_LOW_SCORE = 3

/**
 * Analiza un mensaje individual y retorna su nivel de riesgo.
 * @param {string} text - Mensaje del usuario
 * @returns {{ level: 'bajo'|'medio'|'alto', score: number, triggerWords: string[] }}
 */
export function analyzeMessage(text) {
  const normalized = text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Quitar acentos para comparar

  const triggerWords = []
  let score = 0
  let lowScore = 0

  // Evaluar HIGH primero (score 10 cada match)
  for (const keyword of HIGH_KEYWORDS) {
    const normalizedKeyword = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (normalized.includes(normalizedKeyword)) {
      score += 10
      triggerWords.push(keyword)
    }
  }

  // Evaluar MEDIUM (score 5 cada match)
  for (const keyword of MEDIUM_KEYWORDS) {
    const normalizedKeyword = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (normalized.includes(normalizedKeyword)) {
      score += 5
      triggerWords.push(keyword)
    }
  }

  // Evaluar LOW (score 1 cada match, con tope conjunto)
  for (const keyword of LOW_KEYWORDS) {
    const normalizedKeyword = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (normalized.includes(normalizedKeyword)) {
      lowScore += 1
      triggerWords.push(keyword)   // se listan todas: al profesional le sirven
    }
  }
  score += Math.min(lowScore, MAX_LOW_SCORE)

  // Clasificar nivel
  let level = 'bajo'
  if (score >= 10) level = 'alto'
  else if (score >= 4) level = 'medio'

  return { level, score, triggerWords }
}

/**
 * Mensaje de alerta que se envía automáticamente al usuario cuando se detecta riesgo ALTO.
 */
export const CRISIS_MESSAGE = `Noto que estás pasando por un momento muy difícil, y no quiero que lo atravieses en soledad. Tu bienestar es lo más importante ahora mismo.

Por favor, comunícate con una de estas líneas. Atienden gratis y están para esto:

Colombia — Línea 106, las 24 horas
México — 800-290-0024 (SAPTEL)
España — Línea 024
Argentina — (011) 5275-1135, Centro de Asistencia al Suicida
Otros países — befrienders.org

Si sientes que estás en peligro inmediato, busca a alguien que esté cerca de ti o acude al servicio de urgencias más próximo.

No estás solo. Hablar con un profesional cambia las cosas, y dar ese paso ya es cuidarte.`
