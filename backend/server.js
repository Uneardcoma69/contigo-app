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
import adminRoutes from './routes/admin.js'
import staffRoutes from './routes/staff.js'
import contactRoutes from './routes/contact.js'
import bcrypt from 'bcryptjs'
import { createUser, findUserByEmail, setUserPassword } from './store.js'

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
// Solo protege login/register contra fuerza bruta.
// Las rutas autenticadas (/me, /medical) NO se limitan aquí:
// /me se llama en cada carga de página y agotaría el límite.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  message: { message: 'Demasiados intentos. Espera 15 minutos.' }
})
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, max: 30,
  message: { message: 'Enviaste muchos mensajes. Toma un respiro 🌿' }
})
// Formulario público: evita spam desde la landing
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 10,
  message: { message: 'Recibimos varios mensajes tuyos. Intenta de nuevo más tarde.' }
})

// ── Rutas API ──────────────────────────────────────────────────
app.use('/api/auth/login',    authLimiter)
app.use('/api/auth/register', authLimiter)
app.use('/api/auth',  authRoutes)
app.use('/api/chat',  chatLimiter, chatRoutes)
app.use('/api/goals', goalsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/staff', staffRoutes)
app.use('/api/contact', contactLimiter, contactRoutes)

// ── Seed de cuentas ────────────────────────────────────────────
// Desarrollo: 3 cuentas demo con contraseñas fijas.
// App de escritorio (CONTIGO_ADMIN_PASSWORD): SOLO se crea el admin con
// la contraseña aleatoria generada por la app en la primera ejecución.
// El resto del staff se crea desde la pestaña Equipo del panel admin.
// Idempotente: si el admin ya existe, se sincroniza su contraseña con
// la de config.json para que siempre coincidan.
async function seedDemoAccounts() {
  const desktopAdminPass = process.env.CONTIGO_ADMIN_PASSWORD

  if (desktopAdminPass) {
    const hash = await bcrypt.hash(desktopAdminPass, 10)
    const existing = findUserByEmail('admin@contigo.com')
    if (existing) {
      setUserPassword(existing._id, hash)
    } else {
      createUser({ name: 'Administrador', email: 'admin@contigo.com', password: hash, role: 'admin' })
    }
    console.log('👤 Cuenta admin lista (admin@contigo.com, contraseña en config.json)')
    return
  }

  if (!isDev && process.env.CONTIGO_SEED_DEMO !== 'true') return
  const demo = [
    { name: 'Admin Contigo',    email: 'admin@contigo.com',     password: 'admin123',   role: 'admin' },
    { name: 'Laura Cifuentes',  email: 'psicologa@contigo.com', password: 'contigo123', role: 'psychologist' },
    { name: 'Marco Monitor',    email: 'monitor@contigo.com',   password: 'contigo123', role: 'monitor' },
  ]
  for (const d of demo) {
    if (!findUserByEmail(d.email)) {
      const hash = await bcrypt.hash(d.password, 10)
      createUser({ name: d.name, email: d.email, password: hash, role: d.role })
    }
  }
  console.log('👥 Cuentas demo staff creadas:')
  demo.forEach(d => console.log(`   ${d.role.padEnd(12)} → ${d.email} / ${d.password}`))
}
seedDemoAccounts()

app.get('/api/health', (_req, res) => res.json({
  ok: true,
  storage: 'memory',
  mode: process.env.DEEPSEEK_API_KEY ? 'deepseek' : process.env.OPENAI_API_KEY ? 'openai' : 'demo',
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
  console.log(process.env.CONTIGO_DATA_DIR
    ? `💾 Storage: Archivo JSON persistente (${process.env.CONTIGO_DATA_DIR})`
    : `💾 Storage: Memoria RAM (sin base de datos)`)
  console.log(`🧪 Modo: ${process.env.DEEPSEEK_API_KEY ? 'DeepSeek activo 🐳' : process.env.OPENAI_API_KEY ? 'OpenAI activo ✅' : 'DEMO (sin API key)'}`)
  console.log(`🌐 Frontend: ${frontendDist}\n`)
})
