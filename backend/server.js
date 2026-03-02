import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'

import authRoutes  from './routes/auth.js'
import chatRoutes  from './routes/chat.js'
import goalsRoutes from './routes/goals.js'

dotenv.config()

const app   = express()
const PORT  = process.env.PORT || 5000
const isDev = process.env.NODE_ENV !== 'production'

app.use(helmet())
app.use(cors({ origin: true, credentials: true }))
app.use(morgan(isDev ? 'dev' : 'combined'))
app.use(express.json({ limit: '10kb' }))

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  message: { message: 'Demasiados intentos. Espera 15 minutos.' }
})
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, max: 30,
  message: { message: 'Enviaste muchos mensajes. Toma un respiro 🌿' }
})

app.use('/api/auth',  authLimiter, authRoutes)
app.use('/api/chat',  chatLimiter, chatRoutes)
app.use('/api/goals', goalsRoutes)

app.get('/api/health', (_req, res) => res.json({
  ok: true,
  storage: 'memory',
  mode: process.env.OPENAI_API_KEY ? 'openai' : 'demo',
  timestamp: new Date().toISOString()
}))

app.use((_req, res) => res.status(404).json({ message: 'Ruta no encontrada' }))
app.use((err, _req, res, _next) => {
  console.error('Error:', err)
  res.status(500).json({ message: 'Error interno del servidor' })
})

app.listen(PORT, () => {
  console.log(`\n🚀 Contigo Backend → http://localhost:${PORT}`)
  console.log(`💾 Storage: Memoria RAM (sin MongoDB)`)
  console.log(`🧪 Modo: ${process.env.OPENAI_API_KEY ? 'OpenAI activo ✅' : 'DEMO (sin API key)'}\n`)
})
