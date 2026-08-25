import Icono from './Icono.jsx'
import { APPT_STATUS, tinte } from '../constants.js'

/**
 * Rejilla semanal de citas, de lunes a domingo.
 *
 * La usan el panel del equipo y la pantalla de citas del paciente. Lo que
 * cambia entre ambos es el nombre que se muestra en cada cita (el paciente
 * para el equipo, el profesional para el paciente) y si hay acciones; el
 * resto —cómo se reparten los días, qué se resalta como hoy, cómo se lee
 * la hora— es el mismo, y tenerlo en un solo sitio evita que las dos
 * vistas se separen con el tiempo.
 */

/** Lunes de la semana a la que pertenece esa fecha. */
export function inicioDeSemana(d) {
  const fecha = new Date(d)
  const dia = (fecha.getDay() + 6) % 7   // lunes = 0
  fecha.setDate(fecha.getDate() - dia)
  fecha.setHours(0, 0, 0, 0)
  return fecha
}

/** Texto del rango: «24 ago — 30 ago 2026». */
export function rangoDeSemana(dias) {
  return `${dias[0].toLocaleDateString('es', { day: 'numeric', month: 'short' })} — ` +
         `${dias[6].toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

export function diasDeSemana(inicio) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio)
    d.setDate(d.getDate() + i)
    return d
  })
}

export default function SemanaCitas({ citas, inicio, nombreDe, acciones }) {
  const dias = diasDeSemana(inicio)
  const hoy = new Date()

  const citasDe = (dia) => citas
    .filter(c => {
      const f = new Date(c.date)
      return f.getFullYear() === dia.getFullYear()
        && f.getMonth() === dia.getMonth()
        && f.getDate() === dia.getDate()
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  return (
    // Cada día no baja de 90px: con 1fr puro las columnas se encogían a
    // 40px en un teléfono y no se podía leer ninguna cita. Si no caben,
    // la rejilla se desplaza en horizontal.
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(7, minmax(90px, 1fr))',
      gap: 8, overflowX: 'auto', minWidth: 0, paddingBottom: 4
    }}>
      {dias.map((dia, i) => {
        const esHoy = dia.toDateString() === hoy.toDateString()
        return (
          <div key={i} style={{
            background: esHoy ? 'var(--teal-pale)' : 'var(--cream)',
            border: `1px solid ${esHoy ? 'var(--teal-light)' : 'var(--border)'}`,
            borderRadius: 12, padding: 8, minHeight: 130
          }}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--slate)', textTransform: 'uppercase' }}>
                {dia.toLocaleDateString('es', { weekday: 'short' })}
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 600, color: esHoy ? 'var(--teal-dark)' : 'var(--navy)' }}>
                {dia.getDate()}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {citasDe(dia).map(c => {
                const st = APPT_STATUS[c.status] || APPT_STATUS.programada
                const hora = new Date(c.date).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
                return (
                  <div key={c._id} style={{
                    background: st.bg, border: `1px solid ${tinte(st.color, 19)}`,
                    borderLeft: `3px solid ${st.color}`,
                    borderRadius: 8, padding: '6px 8px', fontSize: '0.72rem'
                  }}>
                    <div style={{ fontWeight: 600, color: st.color }}>{hora} · {c.durationMin}min</div>
                    <div style={{
                      fontWeight: 500, color: 'var(--navy)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>{nombreDe(c)}</div>
                    <div style={{ color: 'var(--slate)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Icono nombre={c.modality === 'online' ? 'enLinea' : 'presencial'} tamano={12} />
                      {st.label}
                    </div>
                    {acciones?.(c)}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
