# Pruebas de la API

Pruebas de integración contra un backend real.

## Cómo ejecutarlas

```bash
npm --prefix backend test
```

`tests/run.mjs` levanta su propio backend — en memoria, en un puerto libre
que elige el sistema operativo — corre la suite completa contra él y lo
apaga al terminar. No hace falta iniciar nada a mano ni reiniciar entre
intentos: cada ejecución parte de una base vacía, así que correrlo dos veces
seguidas da el mismo resultado. Por eso también sirve tal cual en CI.

Para correr un archivo suelto contra un backend que ya tengas abierto en otra
terminal (`npm --prefix backend run dev`), usa `CONTIGO_API_BASE`:

```bash
CONTIGO_API_BASE=http://localhost:3000/api node tests/roles.test.mjs
```

Sin esa variable, cada archivo apunta a `http://localhost:3000/api` por
defecto — sigue funcionando el flujo anterior si lo necesitas para depurar
un archivo en aislamiento, con el mismo cuidado de antes: reiniciar el
backend entre intentos, porque los datos en memoria y los correos fijos de
los tests no cambian.

## Importante

- El limitador de intentos permite 20 inicios de sesión o registros cada 15
  minutos por IP **en producción**, pero 500 en desarrollo. Con el tope de
  producción las últimas suites fallaban con `429` y parecían errores reales.
  `run.mjs` siempre levanta su backend con `NODE_ENV=development`, así que
  esto no debería aparecer.

## Qué cubre cada archivo

| Archivo | Cubre |
|---|---|
| `cifrado.test.mjs` | Cifrado del archivo de datos, migración desde texto plano y protección contra sobrescribir datos ilegibles. **No necesita el servidor.** |
| `roles.test.mjs` | Permisos por rol, asignación de pacientes, validación de fichas, citas, reportes |
| `e2e.test.mjs` | Recorrido completo: registro → chat con IA → análisis de riesgo → metas → ficha → seguimiento del staff |
| `citas-alertas.test.mjs` | Citas visibles para el paciente y resumen de alertas del encabezado |
| `permisos-contacto-ajustes.test.mjs` | Monitor como observador, formulario de contacto y ajustes de IA |
| `contrasenas.test.mjs` | Cambio de contraseña propia, restablecimiento por el administrador e invalidación de sesiones |
| `auditoria.test.mjs` | Qué queda registrado en el log de auditoría, quién puede leerlo y que no se puede alterar desde la aplicación |
| `alerta-riesgo-correo.test.mjs` | Enfriamiento del aviso de riesgo alto por correo. **No necesita el servidor.** |
