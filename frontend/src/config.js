/**
 * Modo vitrina.
 *
 * La interfaz puede publicarse sin el servidor detrás —por ejemplo en un
 * alojamiento estático gratuito— para tener una dirección pública que
 * explique qué es Contigo.
 *
 * En ese caso no hay API: iniciar sesión, registrarse o enviar el
 * formulario fallarían. Antes que mostrar errores, la portada invita a
 * escribir por correo y las pantallas de acceso explican que la
 * plataforma está en fase de piloto.
 *
 * Se activa al compilar con VITE_MODO_VITRINA=true.
 */
export const MODO_VITRINA = import.meta.env.VITE_MODO_VITRINA === 'true'

/** Correo de contacto que se ofrece cuando no hay servidor. */
export const CORREO_CONTACTO = 'hola@contigoaquiestoy.com'
