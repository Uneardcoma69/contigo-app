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
import { createUser, findUserByEmail, setUserPassword, getStorageStatus, flushToDisk, getAllUsers } from './store.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const app   = express()
const PORT  = process.env.PORT || 3000
const isDev = process.env.NODE_ENV !== 'production'

// Desarrollo local declarado a propósito. No es lo mismo que `isDev`:
// si NODE_ENV no llega definida —lo habitual al desplegar— `isDev` da
// verdadero, y con eso se sembraban cuentas de prueba con contraseñas
// conocidas en un servidor público.
const esDesarrolloLocal = process.env.NODE_ENV === 'development'

// ── Detrás de un proxy (Railway, Nginx, etc.) ──────────────────
// Sin esto, todas las peticiones parecen venir de la IP del proxy y el
// limitador de intentos las mete en el mismo cupo: una sola persona
// equivocándose de contraseña dejaría fuera a todas las demás.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1)
}

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
// En producción conviene limitar el origen al dominio propio. Con la
// variable sin definir se refleja el origen, que es lo que necesita la
// app de escritorio cuando apunta a un servidor central.
const origenesPermitidos = (process.env.CONTIGO_ALLOWED_ORIGINS || '')
  .split(',').map(o => o.trim()).filter(Boolean)
app.use(cors({
  origin: origenesPermitidos.length > 0 ? origenesPermitidos : true,
  credentials: true
}))
app.use(morgan(isDev ? 'dev' : 'combined'))
app.use(express.json({ limit: '10kb' }))

// ── Rate Limiting ──────────────────────────────────────────────
// Solo protege login/register contra fuerza bruta.
// Las rutas autenticadas (/me, /medical) NO se limitan aquí:
// /me se llama en cada carga de página y agotaría el límite.
// En desarrollo el tope es alto: la suite de pruebas hace bastantes
// inicios de sesión seguidos y con el tope de producción las últimas
// fallaban con 429, aparentando errores que no existían.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: isDev ? 500 : 20,
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

// ── Cuentas iniciales ──────────────────────────────────────────
// Hay dos caminos, y ninguno crea contraseñas conocidas por accidente:
//
//  1. CONTIGO_ADMIN_PASSWORD — crea SOLO la cuenta de administrador con
//     la contraseña indicada. Es lo que usa la app de escritorio (la
//     genera al azar) y también el camino correcto en un servidor.
//     Idempotente: si el admin ya existe, sincroniza su contraseña.
//
//  2. Cuentas de prueba con contraseñas fijas — únicamente en desarrollo
//     local declarado (NODE_ENV=development) o pidiéndolo a propósito
//     con CONTIGO_SEED_DEMO=true.
//
// El resto del equipo se crea desde la pestaña Equipo del panel admin.
async function seedDemoAccounts() {
  const adminPass = process.env.CONTIGO_ADMIN_PASSWORD

  if (adminPass) {
    const hash = await bcrypt.hash(adminPass, 10)
    const existing = findUserByEmail('admin@contigo.com')
    if (existing) {
      setUserPassword(existing._id, hash)
    } else {
      createUser({ name: 'Administrador', email: 'admin@contigo.com', password: hash, role: 'admin' })
    }
    console.log('👤 Cuenta admin lista (admin@contigo.com)')
    return
  }

  const sembrarDemo = esDesarrolloLocal || process.env.CONTIGO_SEED_DEMO === 'true'
  if (!sembrarDemo) {
    // Sin cuentas y sin forma de entrar: mejor decirlo claro que dejar
    // a alguien adivinando por qué no puede iniciar sesión.
    if (getAllUsers().length === 0) {
      console.warn('\n⚠️  No hay ninguna cuenta y no se creó ninguna automáticamente.')
      console.warn('   Define CONTIGO_ADMIN_PASSWORD con una contraseña segura y reinicia')
      console.warn('   para crear la cuenta de administrador.\n')
    }
    return
  }

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
  if (!esDesarrolloLocal) {
    console.warn('⚠️  Estas contraseñas son públicas. No dejes CONTIGO_SEED_DEMO=true en un servidor.')
  }
}
seedDemoAccounts()

app.get('/api/health', (_req, res) => {
  const almacen = getStorageStatus()
  return res.json({
    ok: !almacen.bloqueado,
    storage: !almacen.persistente ? 'memory' : almacen.cifrado ? 'file-encrypted' : 'file',
    storageBlocked: almacen.bloqueado,
    mode: process.env.DEEPSEEK_API_KEY ? 'deepseek' : process.env.OPENAI_API_KEY ? 'openai' : 'demo',
    timestamp: new Date().toISOString()
  })
})

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

const server = app.listen(PORT, () => {
  const almacen = getStorageStatus()
  console.log(`\n🚀 Contigo Backend → http://localhost:${PORT}`)
  console.log(!almacen.persistente
    ? `💾 Almacenamiento: SQLite en memoria (se pierde al reiniciar)`
    : `💾 Almacenamiento: SQLite en archivo${almacen.cifrado ? ' cifrado 🔒' : ''} (${process.env.CONTIGO_DATA_DIR})`)
  console.log(`🧪 Modo: ${process.env.DEEPSEEK_API_KEY ? 'DeepSeek activo 🐳' : process.env.OPENAI_API_KEY ? 'OpenAI activo ✅' : 'DEMO (sin API key)'}`)
  console.log(`🌐 Frontend: ${frontendDist}\n`)
})

// ── Apagado ordenado ───────────────────────────────────────────
// No se llama a process.exit(): con una base de sql.js abierta, en Windows
// eso aborta el proceso con un fallo de aserción de libuv. En su lugar se
// guardan los datos y se cierra el servidor para que el bucle de eventos
// se vacíe y el proceso termine por su cuenta.
let apagando = false
function apagar(señal) {
  if (apagando) return
  apagando = true
  console.log(`\n${señal} recibida: guardando datos y cerrando...`)
  flushToDisk()
  server.close(() => console.log('👋 Servidor cerrado.'))
  server.closeAllConnections?.()
}
process.on('SIGINT', () => apagar('SIGINT'))
process.on('SIGTERM', () => apagar('SIGTERM'))
