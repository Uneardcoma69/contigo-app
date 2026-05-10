import express from 'express'
import requireAuth from '../middleware/requireAuth.js'
import { getRiskHeatmap, getRiskEvents } from '../store.js'
import { getResources } from '../services/riskDetector.js'

const router = express.Router()

// GET /api/risk/heatmap?days=90
// Devuelve los días con eventos en los últimos N días (1-365).
router.get('/heatmap', requireAuth, (req, res) => {
  const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 90))
  const cells = getRiskHeatmap(req.userId, days)

  const summary = cells.reduce((s, c) => {
    s.totalEvents += c.count
    if (c.level === 'L1') s.L1 += 1
    if (c.level === 'L2') s.L2 += 1
    if (c.level === 'L3') s.L3 += 1
    if (!s.lastDate || c.date > s.lastDate) s.lastDate = c.date
    return s
  }, { totalEvents: 0, daysWithEvents: cells.length, L1: 0, L2: 0, L3: 0, lastDate: null })

  return res.json({ days, cells, summary })
})

// GET /api/risk/events?since=YYYY-MM-DD
// Lista cruda de eventos. Útil para ver el detalle de un día.
router.get('/events', requireAuth, (req, res) => {
  const since = req.query.since ? new Date(req.query.since) : undefined
  const events = getRiskEvents(req.userId, { since })
  return res.json({
    events: events.map(e => ({
      id: e._id,
      level: e.level,
      score: e.score,
      terms: e.terms,
      createdAt: e.createdAt
    }))
  })
})

// GET /api/risk/resources?country=ES
// Líneas de ayuda por país. No requiere auth — debe ser accesible siempre.
router.get('/resources', (req, res) => {
  const country = (req.query.country || 'default').toUpperCase()
  return res.json({ country, resources: getResources(country) })
})

export default router
