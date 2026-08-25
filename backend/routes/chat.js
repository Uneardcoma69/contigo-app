import express from 'express'
import fetch from 'node-fetch'
import requireAuth from '../middleware/requireAuth.js'
import { getHistory, addMessage, clearHistory, findUserById, updateRiskLevel } from '../store.js'
import { analyzeMessage, CRISIS_MESSAGE } from '../riskAnalyzer.js'
import { SYSTEM_PROMPT, construirContexto, respuestaDemo } from '../asistente.js'

const router = express.Router()

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

// POST /api/chat
router.post('/', requireAuth, async (req, res) => {
  const { message } = req.body
  if (!message?.trim()) return res.status(400).json({ reply: 'Mensaje vacío.' })
  if (message.length > 1000) return res.status(400).json({ reply: 'Mensaje demasiado largo.' })

  // ── Análisis de riesgo (se ejecuta SIEMPRE, demo o no) ──────
  const risk = analyzeMessage(message.trim())
  const currentUser = findUserById(req.userId)
  if (currentUser) {
    updateRiskLevel(req.userId, {
      userName: currentUser.name,
      userEmail: currentUser.email,
      level: risk.level,
      score: risk.score,
      lastMessage: message.trim(),
      triggerWords: risk.triggerWords
    })
  }

  // DEMO MODE (Solo si no hay NINGUNA key)
  if (!process.env.OPENAI_API_KEY && !process.env.DEEPSEEK_API_KEY) {
    // La respuesta se elige por el tema del mensaje, no por turno: antes
    // rotaban en orden y a quien escribía sobre el sueño podía tocarle
    // una respuesta sobre otra cosa.
    const raw = respuestaDemo(message)
    const { cleanText, suggestedGoals } = parseGoalsFromReply(raw)
    addMessage(req.userId, 'user', message.trim())
    addMessage(req.userId, 'assistant', cleanText)

    // Si riesgo ALTO, agregar mensaje de crisis
    if (risk.level === 'alto') {
      addMessage(req.userId, 'assistant', CRISIS_MESSAGE)
      return res.json({ reply: cleanText, suggestedGoals, demo: true, crisisAlert: CRISIS_MESSAGE, riskLevel: risk.level })
    }

    return res.json({ reply: cleanText, suggestedGoals, demo: true, riskLevel: risk.level })
  }

  // OPENAI / DEEPSEEK MODE
  try {
    const history = getHistory(req.userId, 20).map(m => ({
      role: m.role, content: m.content
    }))

    // Quién es la persona: su nombre, por qué empezó el acompañamiento y
    // en qué metas trabaja. Sin esto el asistente solo puede hablar en
    // general, que es lo que hacía que sonara de plantilla.
    const contexto = construirContexto(req.userId)

    // Detectar qué proveedor usar
    const isDeepSeek = !!process.env.DEEPSEEK_API_KEY
    const apiKey = isDeepSeek ? process.env.DEEPSEEK_API_KEY : process.env.OPENAI_API_KEY
    const endpoint = isDeepSeek ? 'https://api.deepseek.com/chat/completions' : 'https://api.openai.com/v1/chat/completions'
    const model = isDeepSeek ? 'deepseek-chat' : 'gpt-4o-mini'

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...(contexto ? [{ role: 'system', content: contexto }] : []),
          ...history,
          { role: 'user', content: message.trim() }
        ],
        temperature: 0.75,
        max_tokens: 500
      })
    })

    if (!response.ok) {
      console.error('API Provider error:', response.status)
      return res.status(502).json({ reply: 'Tuve un problema técnico. ¿Lo intentamos de nuevo?' })
    }

    const data = await response.json()
    const raw = data?.choices?.[0]?.message?.content?.trim() || 'Lo siento, no pude generar una respuesta.'
    const { cleanText, suggestedGoals } = parseGoalsFromReply(raw)

    addMessage(req.userId, 'user', message.trim())
    addMessage(req.userId, 'assistant', cleanText)

    // Si riesgo ALTO, agregar mensaje de crisis
    if (risk.level === 'alto') {
      addMessage(req.userId, 'assistant', CRISIS_MESSAGE)
      return res.json({ reply: cleanText, suggestedGoals, crisisAlert: CRISIS_MESSAGE, riskLevel: risk.level })
    }

    return res.json({ reply: cleanText, suggestedGoals, riskLevel: risk.level })

  } catch (e) {
    console.error('Chat error:', e)
    return res.status(500).json({ reply: 'Error al procesar tu mensaje. Inténtalo de nuevo.' })
  }
})

// GET /api/chat/history
router.get('/history', requireAuth, (req, res) => {
  const msgs = getHistory(req.userId, 100).map(m => ({
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
