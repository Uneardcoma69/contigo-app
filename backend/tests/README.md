# Pruebas de la API

Pruebas de integración que se ejecutan contra un backend **recién iniciado**.

## Cómo ejecutarlas

1. Inicia el backend en una terminal:

```bash
npm --prefix backend run dev
```

2. En otra terminal, ejecuta la suite completa:

```bash
npm --prefix backend test
```

## Importante

- **Reinicia el backend antes de cada ejecución completa.** Los datos viven en
  memoria y las pruebas registran usuarios con correos fijos; sin reiniciar,
  el segundo intento falla con `409 (correo ya registrado)`.
- El limitador de intentos permite 20 inicios de sesión / registros cada 15
  minutos por IP. La suite completa consume unos 17, así que cabe en una
  ejecución, pero dos seguidas sin reiniciar darán `429`.

## Qué cubre cada archivo

| Archivo | Cubre |
|---|---|
| `roles.test.mjs` | Permisos por rol, asignación de pacientes, validación de fichas, citas, reportes |
| `e2e.test.mjs` | Recorrido completo: registro → chat con IA → análisis de riesgo → metas → ficha → seguimiento del staff |
| `citas-alertas.test.mjs` | Citas visibles para el paciente y resumen de alertas del encabezado |
| `permisos-contacto-ajustes.test.mjs` | Monitor como observador, formulario de contacto y ajustes de IA |
