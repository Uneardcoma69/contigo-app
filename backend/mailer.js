// ─── Aviso por correo de riesgo alto ────────────────────────────
// El panel de alertas se actualiza por sondeo (cada 15-30 s) mientras
// alguien lo tiene abierto. Si nadie está mirando la pantalla cuando
// una persona escribe algo de riesgo alto, la alerta espera ahí hasta
// que alguien entre. Este correo es el aviso adicional para ese caso.
//
// Sin SMTP configurado, la función no hace nada: el chat, el panel y
// el mensaje de crisis al paciente siguen funcionando igual. El
// correo es un aviso extra, no la vía principal.

import nodemailer from 'nodemailer'

let transporter = null
let avisoFaltaConfig = false

function getTransporter() {
  if (transporter) return transporter
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    if (!avisoFaltaConfig) {
      console.log('ℹ️  SMTP no configurado: las alertas de riesgo alto no se avisan por correo, solo en el panel.')
      avisoFaltaConfig = true
    }
    return null
  }
  const port = Number(process.env.SMTP_PORT) || 587
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  })
  return transporter
}

function destinatarios(staffEmail) {
  const lista = new Set()
  const alerta = (process.env.CONTIGO_ALERT_EMAIL || process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  if (alerta) lista.add(alerta)
  if (staffEmail) lista.add(staffEmail.trim().toLowerCase())
  return [...lista]
}

/**
 * Envía el aviso de riesgo alto. No lanza: un correo que falla no debe
 * tumbar la respuesta del chat ni el resto del flujo de la petición.
 * @param {{userName: string, userEmail: string, lastMessage: string, score: number, triggerWords: string[], staffEmail?: string}} datos
 */
export async function enviarAlertaRiesgoAlto({ userName, userEmail, lastMessage, score, triggerWords, staffEmail }) {
  try {
    const t = getTransporter()
    if (!t) return

    const para = destinatarios(staffEmail)
    if (para.length === 0) return

    const cuerpo = [
      `${userName} (${userEmail}) activó un nivel de riesgo ALTO en el chat de Contigo.`,
      '',
      `Último mensaje: "${lastMessage}"`,
      `Puntaje del análisis: ${score}`,
      triggerWords?.length ? `Señales detectadas: ${triggerWords.join(', ')}` : null,
      '',
      'Este correo es un aviso adicional al panel de alertas. Revise el expediente de la persona en cuanto pueda.'
    ].filter(Boolean).join('\n')

    const info = await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: para.join(', '),
      subject: `Contigo · riesgo ALTO — ${userName}`,
      text: cuerpo
    })

    // Con una cuenta de prueba de Ethereal, sendMail no entrega nada
    // de verdad: devuelve un enlace para ver el correo capturado. Con
    // SMTP real esta llamada no devuelve nada y no imprime nada.
    const vistaPrevia = nodemailer.getTestMessageUrl(info)
    if (vistaPrevia) console.log('✉️  Vista previa del correo de alerta:', vistaPrevia)
  } catch (e) {
    console.error('⚠️ No se pudo enviar el correo de alerta de riesgo alto:', e.message)
  }
}
