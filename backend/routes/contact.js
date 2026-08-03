import express from 'express'
import { createContactMessage } from '../store.js'

const router = express.Router()

// POST /api/contact — formulario público de la landing (sin sesión)
router.post('/', (req, res) => {
  const { nombre, correo, telefono, motivo, mensaje, privacidad } = req.body || {}

  if (!nombre?.trim() || !correo?.trim() || !mensaje?.trim())
    return res.status(400).json({ message: 'Nombre, correo y mensaje son requeridos.' })

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(correo))
    return res.status(400).json({ message: 'El formato del correo no es válido.' })

  if (privacidad !== true)
    return res.status(400).json({ message: 'Debes aceptar la política de tratamiento de datos.' })

  if (mensaje.length > 2000)
    return res.status(400).json({ message: 'El mensaje es demasiado largo (máx. 2000 caracteres).' })

  createContactMessage({ nombre, correo, telefono, motivo, mensaje })
  return res.status(201).json({ ok: true })
})

export default router
