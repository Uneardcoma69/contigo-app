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
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '4px 12px', borderRadius: 999,
        background: cfg.bg, color: cfg.color, border: `1.5px solid ${cfg.border}`,
        fontWeight: 600, fontSize: '0.78rem', whiteSpace: 'nowrap'
      }}
    >
      {cfg.emoji} {cfg.label}
    </span>
  )
}
