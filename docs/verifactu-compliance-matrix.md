# Matriz de cumplimiento VERI*FACTU

Esta matriz describe el alcance técnico del repositorio. No sustituye la declaración responsable del productor, la configuración fiscal del obligado tributario ni las pruebas de aceptación contra la AEAT.

| Área                         | Evidencia en el sistema                                                                                  | Estado                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Integridad y encadenamiento  | `verifactu_ledger`, SHA-256, `previous_ledger_id`, restricciones de unicidad y trigger append-only       | Cubierto técnicamente                                                                |
| Inalterabilidad              | Ledger no actualizable ni borrable; campos fiscales de factura protegidos después de generar el registro | Cubierto técnicamente                                                                |
| Conservación y trazabilidad  | Ledger durable, snapshot del payload, outbox separada y estados de entrega                               | Cubierto técnicamente                                                                |
| XML bien formado             | Parser XML seguro y rechazo de XML vacío/mal formado                                                     | Cubierto técnicamente                                                                |
| XML conforme al esquema AEAT | XSD oficial empaquetado, imports locales, validación offline por defecto                                 | Cubierto técnicamente; verificar cambios de versión                                  |
| Reglas de negocio            | Validación de tipos, fechas, importes, rectificativas, referencias, subsanación y rechazo previo         | Cubierto en la librería; ampliar con cada documento AEAT                             |
| RegistroAlta                 | Alta normal, simplificada y rectificativas R1-R5 con referencias y datos de rectificación                | Cubierto en el flujo actual                                                          |
| RegistroAnulacion            | Conserva el alta, exige aceptación previa y genera un registro de anulación encadenado                   | Cubierto técnicamente                                                                |
| Envío y reintentos           | Outbox transaccional, locks por emisor, orden de cadena, backoff, incidencias y recuperación de workers  | Cubierto técnicamente                                                                |
| Duplicados/idempotencia      | Un registro por factura y tipo; reintento reutiliza el mismo snapshot y huella                           | Cubierto técnicamente                                                                |
| QR                           | URL calculada desde el snapshot inmutable; debe incluirse en la representación de factura                | Parcial: comprobar plantilla PDF y prueba visual en producción                       |
| Identidad del SIF            | `SistemaInformatico` obligatorio y snapshot de productor, producto, versión e instalación                | Cubierto técnicamente                                                                |
| Declaración responsable      | Guía y plantilla dentro del repositorio                                                                  | Pendiente por versión/entorno: completar, firmar y publicar dentro del producto      |
| Certificado y secreto        | P12 solo servidor, nunca se persiste en el ledger ni se expone en logs                                   | Pendiente operativo: rotación, custodia, alerta de expiración y prueba de renovación |
| Protección de datos          | RLS y roles de equipo; payload fiscal contiene datos personales necesarios para el registro              | Pendiente operativo: retención, exportación, accesos y revisión RGPD                 |
| Disponibilidad AEAT          | Fallos transitorios quedan en outbox y no mutan la evidencia fiscal                                      | Cubierto técnicamente; requiere monitorización y runbook                             |
| Aceptación real AEAT         | No se simula en producción; el mock solo sirve para desarrollo                                           | Pendiente: pruebas en entorno AEAT y validación de respuestas reales                 |

## Criterios de salida antes de producción

- Tener identificados productor, `IdSistemaInformatico`, versión, instalación y modalidad declarada.
- Tener la declaración responsable accesible desde el propio SIF y archivada con su versión.
- Configurar certificado de representante válido, secreto fuera del repositorio y alerta de expiración.
- Ejecutar casos AEAT de alta F1/F2, rectificativa R1-R5, anulación, rechazo, reintento e incidencia.
- Verificar que el PDF incluye el QR correcto y que el histórico exportado conserva el XML/payload, huella, respuesta y CSV.
- Aplicar todas las migraciones en un proyecto Supabase de staging, ejecutar pruebas RLS/SQL y después promoverlas a producción.
- Documentar el procedimiento de contingencia: no editar facturas emitidas; corregir mediante rectificativa o anulación según corresponda.

## Fuera del alcance automatizable

La librería no puede declarar por sí sola que una instalación cumple toda la normativa. La responsabilidad legal depende también de la configuración del obligado tributario, el uso efectivo, la custodia del certificado, la representación de la factura, los controles de acceso, las copias/retención y la declaración responsable del productor.
