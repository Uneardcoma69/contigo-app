/**
 * Iconos de la interfaz.
 *
 * Antes se usaban emoji. Se ven distintos en cada sistema y mezclan
 * estilos —unos son de contorno y otros a todo color—, así que la barra
 * de navegación nunca llegaba a verse pareja. Estos comparten rejilla,
 * grosor y remates, y heredan el color del texto, de modo que un icono
 * activo se tiñe solo con el acento.
 *
 * Uso: <Icono nombre="citas" />  ·  <Icono nombre="chat" tamano={20} />
 */

const TRAZOS = {
  inicio: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" /></>,

  chat: <path d="M20 11.5a7.5 7.5 0 0 1-10.9 6.7L4 19.5l1.4-4.6A7.5 7.5 0 1 1 20 11.5Z" />,

  citas: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.5h17" /><path d="M8 3v4M16 3v4" /></>,

  metas: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.4" /></>,

  equipo: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.6a3.2 3.2 0 0 1 0 5.8" /><path d="M17.5 14.4A6 6 0 0 1 21 20" /></>,

  salir: <><path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" /><path d="m16 16 4-4-4-4" /><path d="M20 12H9" /></>,

  flecha: <><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></>,

  alerta: <><path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" /><path d="M12 10v4" /><path d="M12 17.2h.01" /></>,

  reportes: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,

  ajustes: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
}

export default function Icono({ nombre, tamano = 22, className, ...resto }) {
  const trazo = TRAZOS[nombre]
  if (!trazo) return null
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ flexShrink: 0, display: 'block' }}
      {...resto}
    >
      {trazo}
    </svg>
  )
}
