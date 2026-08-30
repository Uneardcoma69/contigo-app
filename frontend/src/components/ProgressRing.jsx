/**
 * Anillo de progreso circular, compartido entre Objetivos (anillo total y
 * uno por categoría) y el Panel del paciente (anillo de metas). Antes cada
 * pantalla habría tenido que repetir la matemática del `stroke-dasharray`;
 * vive acá una sola vez, como ya pasa con `SemanaCitas.jsx` entre paciente
 * y staff.
 *
 * Uso: <ProgressRing pct={43} size={148}><span>43%</span></ProgressRing>
 */
export default function ProgressRing({
  pct = 0,
  size = 74,
  strokeWidth = 7,
  color = 'var(--teal)',
  trackColor = 'var(--surface-warm)',
  children
}) {
  const r = (size - strokeWidth) / 2
  const centro = size / 2
  const circ = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  const dash = `${(clamped / 100 * circ).toFixed(1)} ${circ.toFixed(1)}`

  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
        <circle cx={centro} cy={centro} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={centro} cy={centro} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap={clamped === 0 ? 'butt' : 'round'}
          strokeDasharray={dash}
          transform={`rotate(-90 ${centro} ${centro})`}
        />
      </svg>
      {children && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          {children}
        </div>
      )}
    </div>
  )
}
