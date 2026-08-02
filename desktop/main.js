// ─── Contigo Desktop (Electron) ────────────────────────────────
// Modo A (por defecto): arranca el backend Express embebido y
//   sirve el frontend construido, todo local en un puerto libre.
// Modo B (futuro): si config.json tiene "apiUrl", la app carga esa
//   URL directamente (servidor central, p. ej. Railway) y NO
//   arranca el servidor local. Cambiar de A a B = poner la URL.
//
// La configuración vive en: %APPDATA%/Contigo/config.json
//   {
//     "apiUrl": "",            ← vacío = modo local | URL = servidor central
//     "deepseekApiKey": "",    ← opcional: activa la IA real en modo local
//     "jwtSecret": "..."       ← generado automáticamente la primera vez
//   }

import { app, BrowserWindow, shell, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import net from 'node:net'
import crypto from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Una sola instancia de la app
if (!app.requestSingleInstanceLock()) {
  app.quit()
}

// ── Configuración persistente ──────────────────────────────────
function loadConfig() {
  const dir = app.getPath('userData')
  const file = path.join(dir, 'config.json')
  let cfg = {}
  try { cfg = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { /* primera vez */ }

  let changed = false
  if (typeof cfg.apiUrl !== 'string')        { cfg.apiUrl = ''; changed = true }
  if (typeof cfg.deepseekApiKey !== 'string'){ cfg.deepseekApiKey = ''; changed = true }
  if (!cfg.jwtSecret) {
    cfg.jwtSecret = crypto.randomBytes(32).toString('hex')
    changed = true
  }
  if (changed) {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(file, JSON.stringify(cfg, null, 2))
  }
  return cfg
}

// ── Puerto libre para el servidor local ────────────────────────
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

// ── Modo A: backend embebido ───────────────────────────────────
async function startEmbeddedServer(cfg) {
  const port = await getFreePort()

  process.env.PORT = String(port)
  process.env.NODE_ENV = 'production'
  process.env.JWT_SECRET = cfg.jwtSecret
  process.env.CONTIGO_DATA_DIR = app.getPath('userData')   // datos persistentes
  process.env.CONTIGO_SEED_DEMO = 'true'                   // cuentas demo (idempotente)
  if (cfg.deepseekApiKey) process.env.DEEPSEEK_API_KEY = cfg.deepseekApiKey

  // Importar el servidor Express (escucha al importarse)
  const serverPath = path.join(__dirname, '..', 'backend', 'server.js')
  await import(pathToFileURL(serverPath).href)

  // Esperar a que responda /api/health
  const base = `http://127.0.0.1:${port}`
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${base}/api/health`)
      if (res.ok) return base
    } catch { /* aún no arranca */ }
    await new Promise(r => setTimeout(r, 200))
  }
  throw new Error('El servidor local no respondió a tiempo.')
}

// ── Ventana principal ──────────────────────────────────────────
async function createWindow() {
  const cfg = loadConfig()

  let url
  try {
    // Modo B si hay apiUrl configurada; si no, Modo A local
    url = cfg.apiUrl ? cfg.apiUrl : await startEmbeddedServer(cfg)
  } catch (e) {
    dialog.showErrorBox('Contigo', `No se pudo iniciar la aplicación:\n${e.message}`)
    app.quit()
    return
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: '#fcfaf8',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Enlaces externos → navegador del sistema
  win.webContents.setWindowOpenHandler(({ url: external }) => {
    shell.openExternal(external)
    return { action: 'deny' }
  })

  await win.loadURL(url)
}

app.on('second-instance', () => {
  const [win] = BrowserWindow.getAllWindows()
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.whenReady().then(createWindow)

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('window-all-closed', () => {
  app.quit()   // el 'exit' del store guarda los datos pendientes
})
