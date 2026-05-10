// ─── Detector de riesgo emocional ──────────────────────────────
// Analiza mensajes de chat y devuelve nivel de riesgo (none|L1|L2|L3),
// score acumulado y términos detectados. Es un detector léxico, no IA:
// rápido, auditable, sin costo de API.
//
// Estrategia:
//   1. Normalizar el texto (minúsculas, sin acentos).
//   2. Descartar coincidencias dentro de excepciones ("me muero de risa").
//   3. Buscar patrones por nivel; aplicar atenuación si hay negación cercana.
//   4. Tomar el nivel más alto encontrado y sumar scores con tope.

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const lexiconPath = path.join(__dirname, '..', 'data', 'risk-lexicon.es.json')
const LEXICON = JSON.parse(readFileSync(lexiconPath, 'utf8'))

// Quita acentos y pasa a minúsculas. Preserva espacios y signos básicos.
const COMBINING_DIACRITICS = /[̀-ͯ]/g
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Devuelve true si el índice idx cae dentro de alguna excepción del léxico.
function isInsideException(normalized, idx, exceptions) {
  for (const ex of exceptions) {
    let from = 0
    while ((from = normalized.indexOf(ex, from)) !== -1) {
      if (idx >= from && idx < from + ex.length) return true
      from += ex.length
    }
  }
  return false
}

// Mira las ~5 palabras previas al match buscando negación.
// "ya no quiero suicidarme" → atenúa.
// Ignora el caso en que el patrón ya empieza con la negación (ej: "no aguanto mas"
// no debe auto-anularse por su propio "no").
function isNegated(normalized, matchStart, term, negations) {
  const prefix = normalized.slice(Math.max(0, matchStart - 40), matchStart)
  const tokens = prefix.split(' ').slice(-5).join(' ').trim()
  return negations.some(n => {
    if (term.startsWith(n + ' ') || term === n) return false
    return tokens === n || tokens.endsWith(' ' + n) || tokens.startsWith(n + ' ') || tokens.includes(' ' + n + ' ')
  })
}

/**
 * Analiza un texto y devuelve un objeto:
 *   {
 *     level: 'none' | 'L1' | 'L2' | 'L3',
 *     score: 0-10,
 *     matches: [{ level, term, negated }, ...],
 *     attenuated: boolean   // todas las coincidencias fueron negadas
 *   }
 */
export function analyzeRisk(text) {
  if (!text || typeof text !== 'string') {
    return { level: 'none', score: 0, matches: [], attenuated: false }
  }

  const normalized = normalize(text)
  const { exceptions, negations, levels } = LEXICON
  const raw = []

  // Recorrer niveles en orden de severidad descendente.
  for (const levelKey of ['L3', 'L2', 'L1']) {
    const level = levels[levelKey]
    for (const pattern of level.patterns) {
      let from = 0
      while ((from = normalized.indexOf(pattern, from)) !== -1) {
        if (!isInsideException(normalized, from, exceptions)) {
          const negated = isNegated(normalized, from, pattern, negations)
          raw.push({ level: levelKey, term: pattern, start: from, end: from + pattern.length, negated })
        }
        from += pattern.length
      }
    }
  }

  // Si dos matches del mismo nivel se solapan, conservar solo el más largo.
  // Evita doble-conteo de "quiero hacerme dano" + "hacerme dano".
  raw.sort((a, b) => (b.end - b.start) - (a.end - a.start))
  const matches = []
  for (const m of raw) {
    const overlaps = matches.some(k =>
      k.level === m.level && !(m.end <= k.start || m.start >= k.end))
    if (!overlaps) matches.push(m)
  }

  if (matches.length === 0) {
    return { level: 'none', score: 0, matches: [], attenuated: false }
  }

  // Tomar el nivel más alto NO negado.
  const active = matches.filter(m => !m.negated)
  if (active.length === 0) {
    return { level: 'none', score: 0, matches, attenuated: true }
  }

  const order = { L3: 3, L2: 2, L1: 1 }
  const topLevel = active.reduce((top, m) =>
    order[m.level] > order[top] ? m.level : top, 'L1')

  // Score = score base del nivel top + bonus pequeño por matches adicionales.
  // Cap en 10.
  const baseScore = levels[topLevel].score
  const bonus = Math.min(active.length - 1, 2) * 0.5
  const score = Math.min(10, Math.round((baseScore + bonus) * 10) / 10)

  return { level: topLevel, score, matches, attenuated: false }
}

// Recursos de ayuda por país. Si el código de país no existe, fallback a internacional.
export const HELP_RESOURCES = {
  default: [
    { name: 'Find A Helpline (internacional)', phone: null, url: 'https://findahelpline.com', description: 'Directorio de líneas de ayuda en cualquier país.' }
  ],
  ES: [
    { name: 'Línea 024 - Atención a la conducta suicida', phone: '024', url: null, description: 'Disponible 24/7, gratuita y confidencial.' },
    { name: 'Teléfono de la Esperanza', phone: '717 003 717', url: 'https://telefonodelaesperanza.org', description: 'Apoyo emocional 24h.' }
  ],
  MX: [
    { name: 'SAPTEL', phone: '55 5259-8121', url: 'http://www.saptel.org.mx', description: 'Servicio de Atención Psicológica por Teléfono, 24h.' },
    { name: 'Línea de la Vida', phone: '800 911 2000', url: null, description: 'Atención en crisis, 24h.' }
  ],
  AR: [
    { name: 'Centro de Asistencia al Suicida', phone: '135', url: 'https://www.casbuenosaires.com.ar', description: 'Línea gratuita, atención voluntaria.' }
  ],
  CO: [
    { name: 'Línea 106', phone: '106', url: null, description: 'Línea amiga, atención psicológica.' }
  ],
  CL: [
    { name: 'Salud Responde', phone: '600 360 7777', url: null, description: 'Opción 1: salud mental.' }
  ],
  PE: [
    { name: 'Línea 113', phone: '113', url: null, description: 'Opción 5: salud mental, MINSA.' }
  ]
}

export function getResources(countryCode = 'default') {
  return HELP_RESOURCES[countryCode] || HELP_RESOURCES.default
}
