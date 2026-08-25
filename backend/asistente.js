// ─── De qué se alimenta el asistente ───────────────────────────
// Dos cosas hacían que las respuestas sonaran de plantilla:
//
//   1. El asistente no sabía nada de quien le escribía. Recibía los
//      últimos mensajes y nada más: ni el nombre, ni por qué esa
//      persona empezó el acompañamiento, ni qué metas se propuso. Sin
//      eso, lo único que puede hacer es hablar en general.
//
//   2. No tenía de dónde sacar lo que ofrece. «Practica mindfulness»
//      es un consejo vacío; «inhala cuatro tiempos, retén siete,
//      exhala ocho» es algo que la persona puede hacer ahora mismo.
//
// Este módulo resuelve las dos: reúne el contexto de la persona y le
// da al asistente un repertorio concreto del que echar mano.

import { getGoals, getMedicalRecord, getRiskProfile, findUserById } from './store.js'

// ── Repertorio ─────────────────────────────────────────────────
// Herramientas de apoyo emocional de uso extendido, escritas como
// pasos que se pueden seguir mientras se lee. No sustituyen a un
// tratamiento: son primeros auxilios entre una sesión y otra.
const REPERTORIO = `
HERRAMIENTAS QUE PUEDES OFRECER (elige UNA, la que encaje con lo que trae)

Para ansiedad o agitación
· Respiración 4-7-8: inhalar por la nariz 4 tiempos, retener 7, exhalar por la boca 8. Tres rondas.
· Respiración diafragmática: una mano en el pecho y otra en el vientre; que solo se mueva la del vientre.
· Anclaje 5-4-3-2-1: nombrar 5 cosas que ve, 4 que puede tocar, 3 que oye, 2 que huele, 1 que saborea.
· Agua fría en las muñecas o en la cara: corta la escalada física de la ansiedad.

Para desánimo o falta de energía
· Activación conductual: UNA acción pequeña, concreta y hoy. No «hacer ejercicio», sino «caminar hasta la esquina».
· Regla de los dos minutos: empezar algo durante dos minutos, con permiso explícito de parar después.
· Contacto: escribirle a una persona, aunque sea un mensaje corto.

Para pensamientos que dan vueltas
· Separar el hecho de la interpretación: «¿qué pasó exactamente?» y luego «¿qué me dije sobre eso?».
· Buscar evidencia a favor y en contra de ese pensamiento.
· Preguntar qué le diría a alguien que quiere si estuviera en esa situación.
· Tiempo de preocupación: apartar quince minutos al día para preocuparse, y postergar el resto hasta esa hora.

Para dificultad con el sueño
· Horario de despertar fijo, incluso después de una mala noche: es lo que más ordena el ciclo.
· Si no llega el sueño en veinte minutos, levantarse y hacer algo tranquilo con luz tenue.
· Pantallas fuera de la cama; la cama solo para dormir.
· Volcar en papel lo pendiente antes de acostarse, para no repasarlo en la oscuridad.

Para sensación de estar sobrepasado
· Vaciado: escribir todo lo pendiente y marcar únicamente lo de hoy.
· Partir la tarea grande en el siguiente paso más pequeño posible.
· Nombrar lo que no depende de la persona y dejarlo fuera de la lista.

Para enojo o irritabilidad
· Pausa antes de responder: veinte minutos cambian la respuesta.
· Movimiento físico para descargar antes de conversar.
· Nombrar lo que hay debajo: casi siempre cansancio, miedo o algo que dolió.
`.trim()

const METODO = `
CÓMO RESPONDER

Sigue este orden en cada respuesta:

1. Valida lo que siente, sin apurarte a resolver. Que se note que leíste.
2. Devuélvele con tus palabras lo que entendiste. Si no lo tienes claro, pregunta antes de sugerir.
3. Ofrece UNA sola herramienta del repertorio, explicada en pasos que pueda hacer ahora.
4. Cierra con una pregunta abierta que invite a seguir.

Extensión: entre cuatro y ocho oraciones. Un emoji como máximo, y solo si acompaña.
Tutea siempre. Lenguaje cercano, nunca clínico.
`.trim()

const LIMITES = `
LO QUE NUNCA HACES

· No diagnosticas ni pones nombre a un trastorno, aunque te lo pidan.
· No hablas de medicamentos: ni sugerir, ni ajustar, ni opinar sobre los que toma.
· No minimizas. Nada de «no es para tanto», «todo va a estar bien» ni «hay gente peor».
· No prometes resultados ni plazos.
· No das por sentado el motivo de lo que siente: preguntas.
· No repites la misma herramienta que ya ofreciste en mensajes anteriores; mira el historial.
· Si la persona pide atención profesional, la animas a escribirle a su psicólogo/a desde la aplicación.
`.trim()

const OBJETIVOS = `
SUGERIR OBJETIVOS

Cuando la persona mencione algo que quiere mejorar, lograr o cambiar en sí misma,
añade AL FINAL de tu respuesta un bloque con el formato exacto:

GOALS_JSON:{"goals":[{"title":"Dormir antes de las 11 p. m.","category":"sueño"}]}

Categorías válidas: general, bienestar, sueño, ejercicio, mente, social.
El título debe ser una acción concreta y medible, no un deseo.
Si ya tiene una meta parecida entre las suyas, no la propongas de nuevo.
Si no hay nada que sugerir, no incluyas el bloque.
`.trim()

export const SYSTEM_PROMPT = `Eres "Contigo", un acompañante de bienestar emocional en español.

Acompañas a personas que están en un proceso con un equipo de psicología. No eres su
terapeuta: eres el espacio al que pueden escribir entre una sesión y otra, a cualquier
hora. Tu valor está en escuchar de verdad y en dar algo concreto que puedan hacer hoy.

${METODO}

${REPERTORIO}

${LIMITES}

${OBJETIVOS}`

/**
 * Lo que el asistente sabe de la persona con la que habla.
 *
 * Se envía solo lo que sirve para acompañar mejor. Queda fuera a
 * propósito todo lo que no aporta a la conversación y sí sería
 * sensible en manos de un proveedor externo de IA: medicamentos,
 * antecedentes, contacto de emergencia, teléfono y correo. El motivo
 * de consulta sí se incluye —es lo que da sentido a todo lo demás—,
 * pero recortado.
 */
export function construirContexto(userId) {
  const usuario = findUserById(userId)
  if (!usuario) return ''

  // El nombre va aparte: saberlo no es conocer a la persona, así que no
  // cuenta a la hora de decidir si hay contexto suficiente.
  const nombre = usuario.name?.split(' ')[0]
  const partes = []

  const ficha = getMedicalRecord(userId)
  const motivo = ficha?.info?.motivoConsulta
  if (motivo) {
    partes.push(`Empezó el acompañamiento por esto: "${String(motivo).slice(0, 200)}".`)
  }

  const metas = getGoals(userId)
  const pendientes = metas.filter(m => !m.completed).map(m => m.title)
  const logradas = metas.filter(m => m.completed).map(m => m.title)
  if (pendientes.length) {
    partes.push(`Metas en las que está trabajando: ${pendientes.slice(0, 6).map(t => `"${t}"`).join(', ')}.`)
  }
  if (logradas.length) {
    partes.push(`Ya cumplió: ${logradas.slice(0, 4).map(t => `"${t}"`).join(', ')}. Reconócelo si viene al caso.`)
  }

  const riesgo = getRiskProfile(userId)
  if (riesgo?.level === 'alto') {
    partes.push('Su nivel de riesgo está en ALTO. Prioriza la contención y la cercanía por encima de cualquier ejercicio.')
  } else if (riesgo?.level === 'medio') {
    partes.push('Su nivel de riesgo está en MEDIO. Acompaña con calma y no fuerces el ánimo.')
  }

  const saludo = nombre ? `Se llama ${nombre}.` : ''

  if (!partes.length) {
    return 'SOBRE LA PERSONA CON LA QUE HABLAS\n' + saludo +
      '\nNo sabes nada más de ella: no ha registrado su motivo de consulta ni tiene metas. ' +
      'Pregunta antes de sugerir, y no des por hecho qué la trae aquí.'
  }

  return `SOBRE LA PERSONA CON LA QUE HABLAS\n${[saludo, ...partes].filter(Boolean).join('\n')}\n\n` +
    'Usa esto para que se note que la conoces: llámala por su nombre y menciona sus metas ' +
    'por su título cuando venga al caso. No recites estos datos de vuelta como una ficha.'
}

// ── Modo demostración ──────────────────────────────────────────
// Sin clave de IA, el chat responde con textos escritos de antemano.
// Antes rotaban en orden, así que a quien escribía "no puedo dormir"
// podía tocarle una respuesta sobre otra cosa: nada delata más rápido
// que no hay nadie leyendo. Ahora se elige por el tema del mensaje,
// con el mismo repertorio de arriba.
const POR_TEMA = [
  {
    tema: 'sueño',
    claves: ['dormir', 'sueño', 'insomnio', 'desvelo', 'pesadilla', 'descansar', 'madrugada', 'cansad'],
    respuestas: [
      'Las noches en vela pesan al día siguiente, y ese cansancio hace que todo lo demás se sienta más difícil. Hay algo que ordena el ciclo más que cualquier otra cosa: levantarse siempre a la misma hora, incluso después de una mala noche. Cuesta al principio, pero el cuerpo se acomoda. ¿A qué hora sueles despertarte?\nGOALS_JSON:{"goals":[{"title":"Despertarme a la misma hora todos los días","category":"sueño"}]}',
      'Cuando el sueño no llega, quedarse en la cama peleando suele empeorarlo. Prueba esto: si a los veinte minutos sigues despierto/a, levántate y haz algo tranquilo con luz tenue hasta que vuelva. La cama se reserva para dormir. ¿Qué es lo que te da vueltas cuando apagas la luz?'
    ]
  },
  {
    tema: 'ansiedad',
    claves: ['ansi', 'nervios', 'angustia', 'pánico', 'panico', 'agitad', 'inquiet', 'taquicardia', 'preocupad'],
    respuestas: [
      'La ansiedad se siente en el cuerpo antes de que uno alcance a entenderla, y eso asusta. Vamos a bajarle al cuerpo primero: inhala por la nariz contando cuatro, retén siete, y exhala por la boca contando ocho. Tres rondas, sin apuro. Cuando termines, cuéntame cómo quedaste 🌿',
      'Cuando la mente se acelera, ayuda traerla al presente por los sentidos. Nombra cinco cosas que veas, cuatro que puedas tocar, tres que oigas, dos que huelas y una que saborees. Es raro al principio, pero funciona. ¿Qué fue lo que la disparó hoy?\nGOALS_JSON:{"goals":[{"title":"Hacer el anclaje 5-4-3-2-1 cuando suba la ansiedad","category":"mente"}]}'
    ]
  },
  {
    tema: 'ánimo',
    claves: ['triste', 'deprim', 'vacío', 'vacio', 'sin ganas', 'desanim', 'desmotiv', 'no tengo fuerzas', 'llorar', 'lloro'],
    respuestas: [
      'Gracias por contarme esto. Cuando el ánimo está bajo, lo primero que se apaga son las ganas, y entonces esperar a tenerlas es una trampa: casi nunca llegan solas. Por eso funciona al revés, empezando pequeñísimo. Una sola cosa, hoy, concreta: salir hasta la esquina, abrir la ventana, lavar un plato. ¿Cuál de esas te parece posible?\nGOALS_JSON:{"goals":[{"title":"Hacer una acción pequeña cada día, aunque no tenga ganas","category":"bienestar"}]}',
      'Lo que sientes tiene sentido, aunque ahora no encuentres la razón exacta. No hace falta entenderlo todo para empezar a cuidarte. Te propongo la regla de los dos minutos: eliges algo y lo haces solo dos minutos, con permiso de parar después. Casi siempre se sigue. ¿Hay algo que hayas ido dejando?'
    ]
  },
  {
    tema: 'abrumo',
    claves: ['abrumad', 'sobrepas', 'no doy abasto', 'demasiado', 'mucho encima', 'estr', 'saturad', 'agobi', 'no puedo con todo'],
    respuestas: [
      'Cuando todo se junta, la cabeza lo vive como un solo bloque imposible, y por eso paraliza. Vamos a partirlo: escribe todo lo que tienes pendiente, sin ordenar, y después marca únicamente lo que es de hoy. Lo demás existe, pero no es de hoy. ¿Quieres contarme qué es lo que más pesa?\nGOALS_JSON:{"goals":[{"title":"Escribir lo pendiente y marcar solo lo de hoy","category":"general"}]}',
      'Sentirse sobrepasado/a casi siempre significa que se está cargando también con lo que no depende de uno. Prueba a separar la lista en dos: lo que está en tus manos y lo que no. Lo segundo se puede soltar, aunque duela. ¿Qué hay en esa lista que no dependa de ti?'
    ]
  },
  {
    tema: 'soledad',
    claves: ['solo', 'sola', 'soledad', 'nadie', 'aislad', 'incomprendid', 'no tengo a nadie'],
    respuestas: [
      'Sentirse solo/a duele, y duele todavía más cuando hay gente alrededor. Que me lo cuentes ya es un movimiento en la otra dirección. Hay algo pequeño que suele ayudar: escribirle a una persona, aunque sea un mensaje de una línea y sin motivo. ¿Se te ocurre alguien?\nGOALS_JSON:{"goals":[{"title":"Escribirle a alguien de confianza esta semana","category":"social"}]}',
      'La soledad se alimenta de sí misma: cuanto peor uno se siente, menos ganas dan de buscar a alguien, y así sigue. Romperlo no requiere una conversación larga, basta con un contacto breve. ¿Con quién te sentías cómodo/a antes de todo esto?'
    ]
  },
  {
    tema: 'enojo',
    claves: ['rabia', 'enoj', 'furi', 'molest', 'irritad', 'harta', 'harto', 'injust'],
    respuestas: [
      'La rabia suele estar avisando de algo: un límite que se cruzó, algo que dolió, o puro cansancio acumulado. Antes de responder a lo que la disparó, date veinte minutos. La respuesta que sale después es distinta, y casi siempre mejor. ¿Qué crees que hay debajo de esa rabia?',
      'Tiene sentido que estés así. El enojo pide movimiento antes que palabras: camina, sube escaleras, haz algo con el cuerpo, y conversa después. ¿Qué fue lo que pasó?'
    ]
  }
]

const GENERALES = [
  'Gracias por escribirme. Cuéntame un poco más de lo que está pasando, sin ordenarlo ni explicarlo bien: ¿qué es lo que más te está pesando en estos días?',
  'Te leo. A veces lo primero que sale no es lo que más importa, así que tómate el espacio que necesites. ¿Cómo ha estado tu día hoy?',
  'Aquí estoy. Si te sirve, empieza por lo más reciente: ¿qué fue lo último que te hizo sentir así?'
]

const normalizar = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Se recuerda la última respuesta por tema para no repetirla seguida.
const ultimaPorTema = new Map()

/** Elige una respuesta de demostración acorde al tema del mensaje. */
export function respuestaDemo(mensaje) {
  const texto = normalizar(mensaje || '')

  let elegido = null
  let mejor = 0
  for (const grupo of POR_TEMA) {
    const aciertos = grupo.claves.filter(c => texto.includes(normalizar(c))).length
    if (aciertos > mejor) { mejor = aciertos; elegido = grupo }
  }

  const opciones = elegido ? elegido.respuestas : GENERALES
  const clave = elegido ? elegido.tema : 'general'
  const previa = ultimaPorTema.get(clave)
  const siguiente = opciones.length > 1 && previa !== undefined
    ? (previa + 1) % opciones.length
    : 0
  ultimaPorTema.set(clave, siguiente)
  return opciones[siguiente]
}
