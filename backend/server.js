import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { fileURLToPath } from 'url'

import authRoutes  from './routes/auth.js'
import chatRoutes  from './routes/chat.js'
import goalsRoutes from './routes/goals.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const app   = express()
const PORT  = process.env.PORT || 3000
const isDev = process.env.NODE_ENV !== 'production'

// ── Seguridad ──────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:    ["'self'", "https://fonts.gstatic.com"],
      imgSrc:     ["'self'", "data:", "blob:"],
      scriptSrc:  ["'self'"],
      connectSrc: ["'self'", "https://api.openai.com"],
    }
  }
}))
app.use(cors({ origin: true, credentials: true }))
app.use(morgan(isDev ? 'dev' : 'combined'))
app.use(express.json({ limit: '10kb' }))

// ── Rate Limiting ──────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  message: { message: 'Demasiados intentos. Espera 15 minutos.' }
})
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, max: 30,
  message: { message: 'Enviaste muchos mensajes. Toma un respiro 🌿' }
})

// ── Rutas API ──────────────────────────────────────────────────
app.use('/api/auth',  authLimiter, authRoutes)
app.use('/api/chat',  chatLimiter, chatRoutes)
app.use('/api/goals', goalsRoutes)

app.get('/api/health', (_req, res) => res.json({
  ok: true,
  storage: 'memory',
  mode: process.env.OPENAI_API_KEY ? 'openai' : 'demo',
  timestamp: new Date().toISOString()
}))

// ── Frontend estático (CRÍTICO para Railway) ───────────────────
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist')
app.use(express.static(frontendDist))

// Todas las rutas no-API sirven el index.html de React (SPA routing)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next()
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) {
      res.status(200).send(`
        <h2>🚀 Contigo Backend corriendo</h2>
        <p>En desarrollo, el frontend corre en <a href="http://localhost:5173">localhost:5173</a></p>
        <p>API Health: <a href="/api/health">/api/health</a></p>
      `)
    }
  })
})

// ── Manejo de errores ──────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ message: 'Ruta no encontrada' }))
app.use((err, _req, res, _next) => {
  console.error('Error:', err)
  res.status(500).json({ message: 'Error interno del servidor' })
})

app.listen(PORT, () => {
  console.log(`\n🚀 Contigo Backend → http://localhost:${PORT}`)
  console.log(`💾 Storage: Memoria RAM (sin base de datos)`)
  console.log(`🧪 Modo: ${process.env.OPENAI_API_KEY ? 'OpenAI activo ✅' : 'DEMO (sin API key)'}`)
  console.log(`🌐 Frontend: ${frontendDist}\n`)
})
