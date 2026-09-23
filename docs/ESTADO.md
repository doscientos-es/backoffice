# Estado del backoffice

> Septiembre 2026. Describe lo que el código hace hoy.
> `docs/description.md` es el plan de mayo y no debe usarse como backlog.
> Lo que no se construye está en [`DECISIONS.md`](./DECISIONS.md).
> Los límites de código están en [`decisions/001-cohesive-backoffice-boundaries.md`](./decisions/001-cohesive-backoffice-boundaries.md).

CRM interno de Doscientos Estudio: comercial, entrega, cobro fiscal y operación diaria.
La navegación vive en `lib/navigation/navigation.ts`.

## Qué está hecho

### Trabajo diario

`/inicio` no es solo un panel de KPIs. Arriba está la cola de trabajo:

- **Tu día** (`getMyDay`): tareas abiertas, leads propios y leads sin asignar. Un admin puede ver el equipo.
- **Avisos** (`getAvisos`): recordatorios a 7 días, facturas enviadas vencidas y certificado Verifactu a 30 días.
- **Centro de acciones** (`getActionCenter`): tarea vencida, lead sin primer contacto a las 4 horas, propuesta enviada sin respuesta a las 72 horas. Cada ítem explica por qué está y enlaza al registro.
- KPIs de leads, propuestas y, si el rol lo permite, facturación, cobro pendiente y gasto del mes.

La agenda, las tareas y los recordatorios siguen teniendo su propia pantalla. Inicio no las sustituye; prioriza.

### Ciclo comercial

1. **Lead → cliente** es atómico: `convert_lead_to_client` crea el cliente, marca el lead como `won` y deja una interacción. Meta CAPI se empuja después y no deshace la conversión si falla.
2. **Propuesta aceptada** exige datos fiscales antes de cambiar el estado. La evidencia de firma va por `accept_proposal_with_evidence`.
3. Después, en escrituras separadas y reintentables, se crea o reutiliza el proyecto (`ensureProjectForProposal`), se preparan borradores de factura por hito (`createProposalDraftInvoices`) y se promueve el lead.
4. **Suscripciones**: el cron diario genera la factura del periodo con `generate_subscription_invoice`, que reserva número y avanza el cursor en una transacción. También aplica la actualización por IPC.

El paso 3 no es una sola transacción. Un fallo deja la propuesta aceptada y el proyecto o los borradores a medio crear; las funciones son idempotentes para poder reintentar.

### Finanzas y Verifactu

Facturas, portal público, PDF, rectificativas, envío a AEAT y cola de reintentos están en producción. El runbook es [`VERIFACTU.md`](./VERIFACTU.md). La outbox durable existe para el registro fiscal, no como bus general de email o calendario.

Hay seguimiento automático de impago (`/api/cron/invoice-payment-follow-ups`) además del aviso manual en inicio.

### Fuera del plan de mayo

Ya existen, con el alcance cerrado en `DECISIONS.md` donde aplica:

- Growth: publicidad, newsletters, eventos y social (publicar, inbox, insights).
- Entrega: proyectos y webs de cliente, con backup de webs.
- Espacio de trabajo: documentos internos, marca, equipo y bóveda cifrada.
- Copias del propio backoffice fuera de Supabase (`docs/backups.md`).
- Retención y anonimización de datos de leads.
- IA sobre Vertex: resumen de lead, borrador de email o WhatsApp, siguiente acción y borrador de propuesta.
- Concurrencia optimista: columna `version` y conflicto `code: 'conflict'` en el autoguardado de propuestas.

## Qué queda abierto

- Unificar la aceptación de propuesta, el alta de proyecto y los borradores de factura en una RPC. Hoy el cliente fiscal y la evidencia son previos; el resto es best-effort.
- Hacer visible el conflicto de versión fuera del autoguardado de propuestas. La columna existe en más tablas de las que la UI explica.
- No añadir una outbox genérica salvo que un efecto externo no pueda perderse. Verifactu ya tiene la suya.
- No ampliar social, BI, chat interno ni la bóveda. Esas puertas están cerradas en `DECISIONS.md`.

## Operación programada

Todos los cron exigen `Authorization: Bearer <CRON_SECRET>`.

| Ruta | Qué hace |
| --- | --- |
| `/api/cron/verifactu-outbox` | Reintenta registros AEAT vencidos |
| `/api/cron/subscription-invoices` | Factura suscripciones vencidas y aplica IPC |
| `/api/cron/invoice-payment-follow-ups` | Reclama facturas impagadas |
| `/api/cron/backoffice-backup` | Copia de base de datos y Storage |
| `/api/cron/web-backups` | Copias de las webs gestionadas |
| `/api/cron/daily-responsibilities` | Avisos diarios de responsabilidades |
| `/api/cron/privacy-retention` | Borrados de privacidad y anonimización de leads |
| `/api/cron/social-publish` | Publica lo programado en social |
