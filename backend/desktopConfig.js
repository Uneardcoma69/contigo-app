// ─── Configuración de la app de escritorio ─────────────────────
// Lee y actualiza %APPDATA%/Contigo/config.json (el mismo archivo que
// gestiona Electron). Solo está activo cuando CONTIGO_DATA_DIR existe;
// en modo servidor la configuración viene de variables de entorno.

import fs from 'fs'
import path from 'path'

const DATA_DIR    = process.env.CONTIGO_DATA_DIR || null
const CONFIG_FILE = DATA_DIR ? path.join(DATA_DIR, 'config.json') : null

/** ¿Se puede editar la configuración desde la interfaz? */
export function isDesktop() {
  return !!CONFIG_FILE
}

export function readConfig() {
  if (!CONFIG_FILE) return {}
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
  } catch {
    return {}
  }
}

/**
 * Actualiza solo las claves indicadas, conservando el resto del archivo.
 * Relee antes de escribir para no pisar cambios hechos por Electron.
 */
export function updateConfig(changes) {
  if (!CONFIG_FILE) return false
  try {
    const current = readConfig()
    const next = { ...current, ...changes }
    fs.mkdirSync(DATA_DIR, { recursive: true })
    const tmp = CONFIG_FILE + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2))
    fs.renameSync(tmp, CONFIG_FILE)
    return true
  } catch (e) {
    console.error('⚠️ Error guardando configuración:', e.message)
    return false
  }
}
