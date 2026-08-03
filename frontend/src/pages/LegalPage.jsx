import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import '../landing.css'

// Contenido legal. Redactado para Colombia (Ley 1581 de 2012, habeas data)
// y adaptable: los datos de contacto salen de una sola constante.
const CONTACTO = {
  entidad: 'Contigo — Aquí Estoy',
  correo: 'hola@contigoaquiestoy.com',
  telefono: '(+57) 300 000 0000',
  pais: 'Colombia'
}

const SECCIONES = {
  privacidad: {
    titulo: 'Política de privacidad',
    intro: 'Cómo cuidamos la información que compartes con nosotros.',
    bloques: [
      {
        h: 'Qué información recogemos',
        p: [
          'Datos de tu cuenta: nombre, correo electrónico y una contraseña cifrada (nunca guardamos la contraseña en texto legible).',
          'Contenido de tu proceso: mensajes que escribes en el chat de acompañamiento, objetivos que registras y su progreso.',
          'Ficha de salud: la información que decidas registrar (edad, ocupación, contacto de emergencia, condiciones de salud, medicamentos, antecedentes y motivo de consulta). Completarla es opcional.',
          'Citas y notas del equipo clínico asociadas a tu proceso.'
        ]
      },
      {
        h: 'Para qué la usamos',
        p: [
          'Para prestarte el servicio de acompañamiento: mantener tu sesión, tu historial de conversación y tus objetivos.',
          'Para que el profesional asignado pueda dar seguimiento a tu proceso con contexto.',
          'Para identificar señales de riesgo emocional y ofrecerte información de ayuda cuando corresponda.',
          'No usamos tu información para publicidad ni la vendemos a terceros.'
        ]
      },
      {
        h: 'Quién puede verla',
        p: [
          'Tú, en todo momento, desde tu cuenta.',
          'El profesional (psicólogo o monitor) que tenga tu proceso asignado.',
          'El personal administrativo, únicamente cuando sea necesario para operar y supervisar el servicio.',
          'Ningún otro usuario de la plataforma puede ver tu información.'
        ]
      },
      {
        h: 'Cuánto tiempo la conservamos',
        p: [
          'Mientras tu cuenta esté activa. El historial de conversación conserva los mensajes más recientes de tu proceso.',
          'Si solicitas la eliminación de tus datos, los suprimimos salvo que debamos conservar algo por obligación legal.'
        ]
      },
      {
        h: 'Seguridad',
        p: [
          'Las contraseñas se almacenan cifradas con bcrypt y el acceso se controla con sesiones firmadas.',
          'El acceso a la información clínica está restringido por rol: cada profesional solo alcanza los procesos que tiene asignados.',
          'Ningún sistema es infalible. Si detectamos un incidente que afecte tu información, te lo informaremos.'
        ]
      }
    ]
  },

  datos: {
    titulo: 'Tratamiento de datos personales',
    intro: `Autorización y derechos según la normativa de protección de datos de ${CONTACTO.pais} (Ley 1581 de 2012 y decretos reglamentarios).`,
    bloques: [
      {
        h: 'Responsable del tratamiento',
        p: [
          `${CONTACTO.entidad} es responsable del tratamiento de tus datos personales.`,
          `Puedes contactarnos en ${CONTACTO.correo} o al ${CONTACTO.telefono} para cualquier solicitud relacionada con tu información.`
        ]
      },
      {
        h: 'Datos sensibles',
        p: [
          'La información sobre salud física y mental se considera un dato sensible.',
          'Registrarla es completamente voluntario: puedes usar el servicio sin completar tu ficha de salud.',
          'Al registrarla, autorizas su tratamiento con la finalidad exclusiva de tu acompañamiento.'
        ]
      },
      {
        h: 'Tus derechos',
        p: [
          'Conocer, actualizar y rectificar tus datos personales.',
          'Solicitar prueba de la autorización que otorgaste.',
          'Ser informado sobre el uso que se ha dado a tus datos.',
          'Revocar la autorización y solicitar la supresión de tus datos, cuando no exista un deber legal de conservarlos.',
          'Presentar quejas ante la Superintendencia de Industria y Comercio.'
        ]
      },
      {
        h: 'Cómo ejercer tus derechos',
        p: [
          `Escríbenos a ${CONTACTO.correo} indicando tu nombre, el derecho que deseas ejercer y una descripción de tu solicitud.`,
          'Responderemos las consultas en un plazo máximo de diez (10) días hábiles y los reclamos en quince (15) días hábiles, conforme a la ley.'
        ]
      },
      {
        h: 'Secreto profesional',
        p: [
          'La información compartida con un profesional en el marco de tu proceso está amparada por el secreto profesional.',
          'Solo se levantaría en los casos excepcionales previstos por la ley, como un riesgo inminente para tu vida o la de otra persona.'
        ]
      }
    ]
  },

  terminos: {
    titulo: 'Términos de uso',
    intro: 'Las reglas del servicio, en lenguaje claro.',
    bloques: [
      {
        h: 'Qué es Contigo',
        p: [
          'Contigo es una plataforma de acompañamiento y bienestar emocional que conecta a las personas con profesionales de la psicología.',
          'El chat incluye un asistente conversacional de apoyo. Ese asistente no es un profesional de la salud, no emite diagnósticos ni prescribe tratamientos.'
        ]
      },
      {
        h: 'No es un servicio de urgencias',
        p: [
          'Contigo no atiende emergencias ni crisis en tiempo real.',
          `Si tú o alguien cercano está en riesgo inmediato, comunícate con la línea de emergencia de tu país (123 en ${CONTACTO.pais}) o acude al servicio de urgencias más cercano.`
        ]
      },
      {
        h: 'Tu cuenta',
        p: [
          'Eres responsable de la veracidad de la información que registras y de mantener tu contraseña segura.',
          'La cuenta es personal e intransferible.',
          'Debes ser mayor de edad para crear una cuenta por tu cuenta. Los menores requieren autorización de su representante legal.'
        ]
      },
      {
        h: 'Uso adecuado',
        p: [
          'No está permitido usar la plataforma para acosar, suplantar a otras personas ni difundir contenido ilícito.',
          'Podemos suspender cuentas que incumplan estas condiciones.'
        ]
      },
      {
        h: 'Cambios',
        p: [
          'Podemos actualizar estos términos para reflejar mejoras del servicio o cambios normativos.',
          'Los cambios relevantes se comunicarán a través de la plataforma.'
        ]
      }
    ]
  }
}

const ORDEN = ['privacidad', 'datos', 'terminos']
const RUTA = { privacidad: '/legal/privacidad', datos: '/legal/datos', terminos: '/legal/terminos' }

export default function LegalPage() {
  const { seccion } = useParams()
  const clave = SECCIONES[seccion] ? seccion : 'privacidad'
  const doc = SECCIONES[clave]

  useEffect(() => { window.scrollTo(0, 0) }, [clave])

  return (
    <div className="landing">
      <header className="site-header is-scrolled">
        <div className="lp-container header-inner">
          <Link className="brand" to="/" aria-label="Contigo — Aquí Estoy. Ir al inicio">
            <span className="brand-mark" aria-hidden="true"></span>
            <span className="brand-name">
              <strong>Contigo</strong>
              <small>Aquí estoy</small>
            </span>
          </Link>
          <Link className="lp-btn lp-btn-secondary nav-cta" to="/">← Volver al inicio</Link>
        </div>
      </header>

      <main className="lp-section">
        <div className="lp-container" style={{ maxWidth: 820 }}>
          <p className="eyebrow">Información legal</p>
          <h1 style={{ fontSize: 'clamp(1.9rem, 3.6vw, 2.5rem)', marginBottom: '0.6rem' }}>{doc.titulo}</h1>
          <p style={{ color: 'var(--slate)', fontSize: '1.05rem', marginBottom: '2rem' }}>{doc.intro}</p>

          <nav style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '2.5rem' }}>
            {ORDEN.map(k => (
              <Link
                key={k}
                to={RUTA[k]}
                className={`lp-btn ${k === clave ? 'lp-btn-primary' : 'lp-btn-secondary'}`}
                style={{ fontSize: '0.85rem', padding: '0.6rem 1.1rem' }}
              >
                {SECCIONES[k].titulo}
              </Link>
            ))}
          </nav>

          {doc.bloques.map(b => (
            <section key={b.h} style={{ marginBottom: '2.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>{b.h}</h2>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.6rem' }}>
                {b.p.map((linea, i) => (
                  <li key={i} style={{ color: 'var(--slate)', fontSize: '0.98rem', lineHeight: 1.65 }}>{linea}</li>
                ))}
              </ul>
            </section>
          ))}

          <aside className="notice" style={{ marginTop: '2.5rem' }}>
            <strong>¿Tienes dudas o quieres ejercer tus derechos?</strong>
            <p>
              Escríbenos a <a href={`mailto:${CONTACTO.correo}`}>{CONTACTO.correo}</a> o llámanos al {CONTACTO.telefono}.
              Te responderemos dentro de los plazos que establece la ley.
            </p>
          </aside>
        </div>
      </main>

      <footer className="site-footer">
        <div className="lp-container footer-bottom" style={{ borderTop: 'none' }}>
          <p>&copy; {new Date().getFullYear()} {CONTACTO.entidad}. Todos los derechos reservados.</p>
          <p>Este sitio no reemplaza la atención de urgencias.</p>
        </div>
      </footer>
    </div>
  )
}
