# VERI*FACTU en el backoffice

Runbook del adaptador Supabase que consume `@doscientos/verifactu`. La guía
reutilizable para proyectos nuevos está en
`modules/verifactu/docs/INTEGRATION.es.md`.

## Frontera de responsabilidades

### Paquete

- Contratos fiscales, XML/XSD, QR y hashes.
- Alta, Anulación, Subsanación y Alta por rechazo.
- Snapshot SIF y validación de payload durable.
- Envío, duplicados, reintentos, errores AEAT y VNif.

### Backoffice

- Mapper desde factura/cliente/empresa.
- RPC atómicas, ledger y outbox Supabase.
- Autorización, MFA, cron, UI, PDF y portal.
- Persistencia minimizada de respuestas AEAT.

No añadir reglas fiscales nuevas en acciones, componentes o SQL sin comprobar
primero si pertenecen al paquete.

## Archivos principales

- `lib/verifactu/config.ts`: único adaptador de variables de entorno.
- `lib/verifactu/outbox.ts`: reclamación/persistencia Supabase; la entrega se
  delega a `deliverDurableVerifactuRecord`.
- `lib/clients/fiscal-verification.ts`: orquestación local de VNif.
- `app/api/cron/verifactu-outbox/route.ts`: procesamiento programado.
- `supabase/migrations/*verifactu*.sql`: tablas, restricciones y RPC.
- `lib/verifactu/migrations.test.ts`: regresiones textuales de migraciones.

## Flujo de emisión

1. Validar datos y destinatario F1.
2. La RPC de emisión bloquea el emisor y añade ledger/outbox en una transacción.
3. `deliverInvoiceVerifactu` reclama el outbox.
4. El paquete verifica payload, snapshot y huella; después envía a AEAT.
5. `complete_verifactu_outbox_v2` persiste estado, CSV, error y próximo intento.
6. El QR de factura se genera desde el último Alta inmutable.

## Regularización

- Un rechazo definitivo no se reenvía.
- Se vuelve a validar el destinatario con AEAT.
- Se crea otro Alta con `Subsanacion=S` y `RechazoPrevio=X`.
- El predecesor es el último registro global del emisor.
- Los registros rechazados y terminales no bloquean indefinidamente la cadena.

## Anulación

- Solo puede anularse una Alta aceptada por AEAT.
- Si hubo regularizaciones, se selecciona la última Alta aceptada.
- La anulación es otro registro append-only de la cadena global.

## Actualizar el paquete vendorizado

1. Ejecutar en `modules/verifactu`: `pnpm test`, `pnpm typecheck`, `pnpm build`.
2. Crear el tarball con `pnpm pack --pack-destination ../../internal/backoffice/vendor`.
3. Instalarlo con `pnpm add @doscientos/verifactu@file:vendor/<tarball>`.
4. Ejecutar `scripts/verify-verifactu-package.mjs`.
5. Validar tests, typecheck y build del backoffice.

No editar manualmente `pnpm-lock.yaml`. Si cambia el contenido de un tarball con
la misma versión local, usar un nombre de revisión distinto para evitar caché.

## Migraciones

Orden obligatorio:

1. Producción gestionada mediante la API/MCP de Supabase.
2. Verificación de funciones e integridad del ledger.
3. Demo self-hosted mediante SSH y `psql -v ON_ERROR_STOP=1`.
4. Verificación equivalente en demo.

La demo y producción son bases independientes. Nunca compartir credenciales,
datos ni seeds. No editar una migración aplicada; crear una correctiva.

## Comprobaciones mínimas

```powershell
pnpm exec vitest run lib/verifactu --reporter=dot
pnpm typecheck
$env:CI='1'; pnpm build
node scripts/verify-verifactu-package.mjs
```

En base de datos comprobar además:

- `unique (issuer_nif, chain_sequence)` sin duplicados.
- Cada `previous_hash` coincide con `previous_ledger.current_hash`.
- Las funciones de claim aceptan predecesores `accepted`, `rejected` y
  `terminal_error` como estados terminales.
- La regularización encadena globalmente y exige preflight censal.
- La anulación selecciona la última Alta aceptada.