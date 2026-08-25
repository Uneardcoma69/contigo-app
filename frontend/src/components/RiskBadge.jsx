import { LEVEL_CONFIG } from '../constants.js'

/**
 * Distintivo del nivel de riesgo de un paciente.
 * El nivel alto late para que destaque entre el resto: es la señal que
 * el equipo debe atender primero.
 */
export default function RiskBadge({ level }) {
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.sin_datos
  return (
    <span
      className={level === 'alto' ? 'risk-badge risk-badge--pulse' : 'risk-badge'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '5px 12px', borderRadius: 999,
        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}2e`,
        fontWeight: 600, fontSize: '0.78rem', whiteSpace: 'nowrap',
        letterSpacing: 'var(--tracking-snug)'
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'currentColor', flexShrink: 0
        }}
      />
      {cfg.label}
    </span>
  )
}
