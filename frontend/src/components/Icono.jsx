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

  pacientes: <><circle cx="12" cy="7.5" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,

  notas: <><path d="M5.5 3.5h13a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" /><path d="M8.5 8h7M8.5 12h7M8.5 16h4" /></>,

  ficha: <><path d="M6 3.5h12a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" /><path d="M12 8.5v6M9 11.5h6" /></>,

  mensajes: <><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="m3.6 6.6 8.4 6 8.4-6" /></>,

  auditoria: <><path d="M7 3.5h10a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" /><path d="M9.5 8.5h5M9.5 12h5M9.5 15.5h3" /></>,

  cuenta: <><rect x="4.5" y="10" width="15" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,

  calendario: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.5h17" /><path d="M8 3v4M16 3v4" /></>,

  // ── Estado y acciones ──
  check:    <path d="m4.5 12.5 5 5 10-11" />,
  cerrar:   <path d="M6 6l12 12M18 6 6 18" />,
  circulo:  <circle cx="12" cy="12" r="8.5" />,
  prohibir: <><circle cx="12" cy="12" r="8.5" /><path d="m6.2 6.2 11.6 11.6" /></>,
  candado:  <><rect x="4.5" y="10" width="15" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  llave:    <><circle cx="7.5" cy="12" r="3.5" /><path d="M11 12h9M17 12v3.5M20 12v2.5" /></>,
  correo:   <><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="m3.6 6.6 8.4 6 8.4-6" /></>,
  info:     <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5" /><path d="M12 7.8h.01" /></>,

  // ── Personas y modalidad ──
  persona:  <><circle cx="12" cy="7.5" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  asistente:<><rect x="4" y="7.5" width="16" height="12" rx="3" /><path d="M12 4.5v3" /><circle cx="9" cy="13" r="1.1" /><circle cx="15" cy="13" r="1.1" /></>,
  enLinea:  <><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 20h8" /></>,
  presencial:<><path d="M4 20V8.5l8-5 8 5V20" /><path d="M9.5 20v-6h5v6" /></>,

  // ── Categorías de metas ──
  estrella: <path d="m12 3.8 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9-5.3-2.9-5.3 2.9 1.1-5.9L3.5 10l5.9-.8L12 3.8Z" />,
  hoja:     <><path d="M20 4c0 9-5.5 13-11 13a5 5 0 0 1-5-5C4 6.5 12.5 4 20 4Z" /><path d="M4 20c3.5-5 7-8 11-10" /></>,
  luna:     <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />,
  pesa:     <><path d="M4 9v6M7 7.5v9M17 7.5v9M20 9v6M7 12h10" /></>,
  mente:    <><circle cx="12" cy="12" r="8.5" /><path d="M12 8.2a3.8 3.8 0 0 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" /></>,
  personas: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.6a3.2 3.2 0 0 1 0 5.8" /><path d="M17.5 14.4A6 6 0 0 1 21 20" /></>,

  // ── Otros ──
  mapa:     <><path d="M9 4 3.5 6.5v13L9 17l6 2.5 5.5-2.5v-13L15 6.5 9 4Z" /><path d="M9 4v13M15 6.5v13" /></>,
  escudo:   <path d="M12 3.2 4.5 6.2v5.4c0 4.4 3.1 8.2 7.5 9.2 4.4-1 7.5-4.8 7.5-9.2V6.2L12 3.2Z" />,
  bandeja:  <><path d="M3.5 13.5h4l1.5 3h6l1.5-3h4" /><path d="M5.5 5h13l2 8.5v4a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-4L5.5 5Z" /></>,
  fiesta:   <><path d="m4 20 5.5-13 8.5 8.5L4 20Z" /><path d="M14 4.5v2M18.5 8h2M17 3l1.5 1.5" /></>,

  papelera: <><path d="M4 6.5h16" /><path d="M9.5 6.5V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.7" /><path d="M6.5 6.5 7.4 20a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9l.9-13.5" /><path d="M10.5 10.5v6M13.5 10.5v6" /></>,

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
