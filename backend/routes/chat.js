import express from 'express'
import fetch from 'node-fetch'
import requireAuth from '../middleware/requireAuth.js'
import { getHistory, addMessage, clearHistory, addRiskEvent } from '../store.js'
import { analyzeRisk } from '../services/riskDetector.js'

const router = express.Router()

const SYSTEM_PROMPT = `Eres "Contigo", un asistente de apoyo emocional y bienestar mental en español.

Tu personalidad:
- Empático, cálido y sin juicios
- Lenguaje cercano y sencillo, nunca clínico
- Ofreces herramientas prácticas: respiración, mindfulness, grounding, rutinas saludables
- NO eres terapeuta — si hay riesgo, recomienda ayuda profesional con cariño

Cómo responder:
- Primero valida los sentimientos del usuario
- Luego ofrece una perspectiva o herramienta concreta
- Respuestas de 4–8 oraciones, máximo 1 emoji por mensaje

FUNCIÓN ESPECIAL — Sugerir objetivos:
Cuando el usuario mencione algo que quiere mejorar, lograr o trabajar en sí mismo
(ej: dormir mejor, meditar, hacer ejercicio, reducir estrés, leer más, etc.),
DEBES incluir al final de tu respuesta un bloque JSON con objetivos sugeridos.

Formato EXACTO (siempre al final, nunca en medio del texto):
GOALS_JSON:{"goals":[{"title":"Meditar 10 minutos cada mañana","category":"mente"},{"title":"Dormir antes de las 11pm","category":"sueño"}]}

Categorías válidas: general, bienestar, sueño, ejercicio, mente, social

Solo incluye GOALS_JSON cuando sea genuinamente relevante (el usuario habla de querer cambiar algo).
Si no hay objetivos que sugerir, no incluyas GOALS_JSON.`

const DEMO_RESPONSES = [
  "Gracias por compartir eso conmigo 🌿 Lo que sientes es completamente válido. Practiquemos una respiración 4-7-8: inhala 4 segundos, retén 7, exhala 8. ¿Lo intentamos juntos?\nGOALS_JSON:{\"goals\":[{\"title\":\"Practicar respiración 4-7-8 cada día\",\"category\":\"mente\"}]}",
  "Te escucho. A veces el peso del día puede sentirse enorme. Prueba el grounding: nombra 5 cosas que ves, 4 que tocas, 3 que escuchas. Trae tu mente al presente.",
  "Tiene sentido que te sientas así. Nuestras emociones son mensajes, no problemas. ¿Qué es lo que más está pesando ahora mismo? Cuéntame.",
  "Un pequeño paso para hoy: 5 minutos solo para ti, sin pantallas ni ruido. A veces el descanso es la acción más valiente 🌿\nGOALS_JSON:{\"goals\":[{\"title\":\"5 minutos de silencio sin pantallas cada día\",\"category\":\"bienestar\"}]}",
  "No estás solo/a en esto. Muchas personas sienten lo mismo. ¿Has podido hablar con alguien de confianza hoy?",
  "Cuando todo parece mucho, ayuda dividir: ¿qué es lo único que podrías hacer hoy que marcaría una diferencia pequeña?\nGOALS_JSON:{\"goals\":[{\"title\":\"Identificar una tarea pequeña y completarla\",\"category\":\"general\"},{\"title\":\"Escribir 3 cosas positivas del día\",\"category\":\"bienestar\"}]}",
  "Pon una mano en el corazón, siente el calor, y di 'estoy aquí, esto pasará'. Es simple pero funciona 🌿",
]
let demoIndex = 0

function parseGoalsFromReply(text) {
  const marker = 'GOALS_JSON:'
  const idx = text.indexOf(marker)
  if (idx === -1) return { cleanText: text, suggestedGoals: [] }

  const cleanText = text.slice(0, idx).trim()
  try {
    const jsonStr = text.slice(idx + marker.length).trim()
    const parsed = JSON.parse(jsonStr)
    return { cleanText, suggestedGoals: parsed.goals || [] }
  } catch {
    return { cleanText, suggestedGoals: [] }
  }
}

// Refuerzo al system prompt cuando se detecta riesgo. Le pide a la IA
// extra cuidado y SIEMPRE recomendar ayuda profesional/línea de emergencia
// en niveles L2/L3, sin ser alarmista.
function riskSystemHint(level) {
  if (level === 'L3') {
    return `\n\nCONTEXTO IMPORTANTE: El último mensaje del usuario contiene señales de crisis grave (ideación suicida, despedida o mención de método). Responde con MUCHA calma y empatía. Valida lo que siente, agradece que comparta. SIEMPRE recomienda contactar una línea de ayuda profesional 24h o acudir a urgencias. No minimices, no des consejos genéricos. NO incluyas GOALS_JSON en este mensaje.`
  }
  if (level === 'L2') {
    return `\n\nCONTEXTO IMPORTANTE: El usuario muestra desesperanza profunda o autolesión. Responde con extra cuidado, valida su dolor sin minimizar y sugiere de forma cálida hablar con un profesional de salud mental. NO incluyas GOALS_JSON en este mensaje.`
  }
  return ''
}

// POST /api/chat
router.post('/', requireAuth, async (req, res) => {
  const { message } = req.body
  if (!message?.trim()) return res.status(400).json({ reply: 'Mensaje vacío.' })
  if (message.length > 1000) return res.status(400).json({ reply: 'Mensaje demasiado largo.' })

  const cleanMsg = message.trim()
  const risk = analyzeRisk(cleanMsg)
  if (risk.level !== 'none') {
    addRiskEvent(req.userId, { level: risk.level, score: risk.score, matches: risk.matches })
  }

  const riskPayload = risk.level === 'none'
    ? null
    : { level: risk.level, score: risk.score }

  // DEMO MODE (Solo si no hay NINGUNA key)
  if (!process.env.OPENAI_API_KEY && !process.env.DEEPSEEK_API_KEY) {
    let reply
    if (risk.level === 'L3') {
      reply = 'Lo que me cuentas pesa mucho y te agradezco la confianza. No estás solo/a en esto. Por favor contacta una línea de ayuda profesional ahora mismo — están para escucharte sin juicio. En el panel verás los números disponibles en tu país. Yo sigo aquí contigo.'
    } else if (risk.level === 'L2') {
      reply = 'Entiendo que estás cargando algo muy pesado. Lo que sientes es real y merece atención profesional, no solo una conversación. ¿Has podido considerar hablar con alguien especializado? Mientras, intenta una respiración lenta: inhala 4, exhala 6.'
    } else {
      const raw = DEMO_RESPONSES[demoIndex % DEMO_RESPONSES.length]
      demoIndex++
      reply = parseGoalsFromReply(raw).cleanText
    }
    const { cleanText, suggestedGoals } = parseGoalsFromReply(reply)
    addMessage(req.userId, 'user', cleanMsg)
    addMessage(req.userId, 'assistant', cleanText)
    return res.json({ reply: cleanText, suggestedGoals, demo: true, risk: riskPayload })
  }

  // OPENAI / DEEPSEEK MODE
  try {
    const history = getHistory(req.userId).slice(-20).map(m => ({
      role: m.role, content: m.content
    }))

    const isDeepSeek = !!process.env.DEEPSEEK_API_KEY
    const apiKey = isDeepSeek ? process.env.DEEPSEEK_API_KEY : process.env.OPENAI_API_KEY
    const endpoint = isDeepSeek ? 'https://api.deepseek.com/chat/completions' : 'https://api.openai.com/v1/chat/completions'
    const model = isDeepSeek ? 'deepseek-chat' : 'gpt-4o-mini'

    const systemContent = SYSTEM_PROMPT + riskSystemHint(risk.level)

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemContent },
          ...history,
          { role: 'user', content: cleanMsg }
        ],
        temperature: risk.level === 'L3' ? 0.4 : 0.75,
        max_tokens: 500
      })
    })

    if (!response.ok) {
      console.error('API Provider error:', response.status)
      return res.status(502).json({ reply: 'Tuve un problema técnico. ¿Lo intentamos de nuevo?', risk: riskPayload })
    }

    const data = await response.json()
    const raw = data?.choices?.[0]?.message?.content?.trim() || 'Lo siento, no pude generar una respuesta.'
    const { cleanText, suggestedGoals } = parseGoalsFromReply(raw)

    addMessage(req.userId, 'user', cleanMsg)
    addMessage(req.userId, 'assistant', cleanText)

    return res.json({ reply: cleanText, suggestedGoals, risk: riskPayload })

  } catch (e) {
    console.error('Chat error:', e)
    return res.status(500).json({ reply: 'Error al procesar tu mensaje. Inténtalo de nuevo.', risk: riskPayload })
  }
})

// GET /api/chat/history
router.get('/history', requireAuth, (req, res) => {
  const msgs = getHistory(req.userId).slice(-40).map(m => ({
    id: m._id,
    from: m.role === 'user' ? 'user' : 'bot',
    text: m.content,
    timestamp: m.createdAt
  }))
  return res.json({ messages: msgs })
})

// DELETE /api/chat/history
router.delete('/history', requireAuth, (req, res) => {
  clearHistory(req.userId)
  return res.json({ ok: true })
})

export default router
