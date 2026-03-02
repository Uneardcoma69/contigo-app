import express from 'express'
import requireAuth from '../middleware/requireAuth.js'
import { getGoals, createGoal, toggleGoal, deleteGoal } from '../store.js'

const router = express.Router()

const VALID_CATEGORIES = ['general', 'bienestar', 'sueño', 'ejercicio', 'mente', 'social']

// GET /api/goals — obtener todos los objetivos del usuario
router.get('/', requireAuth, (req, res) => {
  const list = getGoals(req.userId)
  return res.json({ goals: list })
})

// POST /api/goals — crear un objetivo
router.post('/', requireAuth, (req, res) => {
  const { title, category } = req.body

  if (!title?.trim())
    return res.status(400).json({ message: 'El título es requerido.' })
  if (title.trim().length > 120)
    return res.status(400).json({ message: 'El título es demasiado largo.' })

  const cat = VALID_CATEGORIES.includes(category) ? category : 'general'
  const goal = createGoal(req.userId, { title, category: cat })
  return res.status(201).json({ goal })
})

// PATCH /api/goals/:id — marcar/desmarcar como completado
router.patch('/:id', requireAuth, (req, res) => {
  const goal = toggleGoal(req.userId, req.params.id)
  if (!goal) return res.status(404).json({ message: 'Objetivo no encontrado.' })
  return res.json({ goal })
})

// DELETE /api/goals/:id — eliminar un objetivo
router.delete('/:id', requireAuth, (req, res) => {
  const deleted = deleteGoal(req.userId, req.params.id)
  if (!deleted) return res.status(404).json({ message: 'Objetivo no encontrado.' })
  return res.json({ ok: true })
})

export default router
