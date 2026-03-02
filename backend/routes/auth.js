import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { findUserByEmail, findUserById, createUser } from '../store.js'
import requireAuth from '../middleware/requireAuth.js'

const router = express.Router()

function createToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' })
}

function sanitize(user) {
  return { id: user._id, name: user.name, email: user.email }
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body
    if (!name?.trim() || !email?.trim() || !password)
      return res.status(400).json({ message: 'Todos los campos son requeridos.' })
    if (password.length < 6)
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' })
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email))
      return res.status(400).json({ message: 'El formato del correo no es válido.' })
    if (findUserByEmail(email))
      return res.status(409).json({ message: 'Este correo ya está registrado.' })
    const hash = await bcrypt.hash(password, 12)
    const user = createUser({ name, email, password: hash })
    const token = createToken(user._id)
    return res.status(201).json({ token, user: sanitize(user) })
  } catch (e) {
    console.error('Register error:', e)
    return res.status(500).json({ message: 'Error al crear la cuenta.' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email?.trim() || !password)
      return res.status(400).json({ message: 'Correo y contraseña son requeridos.' })
    const user = findUserByEmail(email)
    if (!user)
      return res.status(401).json({ message: 'Correo o contraseña incorrectos.' })
    const ok = await bcrypt.compare(password, user.password)
    if (!ok)
      return res.status(401).json({ message: 'Correo o contraseña incorrectos.' })
    const token = createToken(user._id)
    return res.json({ token, user: sanitize(user) })
  } catch (e) {
    console.error('Login error:', e)
    return res.status(500).json({ message: 'Error al iniciar sesión.' })
  }
})

router.get('/me', requireAuth, (req, res) => {
  const user = findUserById(req.userId)
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' })
  return res.json({ user: sanitize(user) })
})

export default router
