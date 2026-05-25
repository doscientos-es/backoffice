# doscientos CRM — Especificacion Tecnica Completa

> Version: 2.0 - Mayo 2026
> Empresa: DOSCIENTOS DESARROLLO TECNOLOGICO, S.L. - Barcelona
> Subdominio: app.doscientos.es | Repo: doscientos/internal-backoffice
> Este documento es la fuente de verdad para la generacion asistida por IA del proyecto.

---

## 1. Vision del producto

CRM interno + portal de cliente unificado para una agencia de desarrollo web de 2 personas (Pol y Gerard). Elimina el intercambio de PDFs: cada presupuesto o factura es una URL web que el cliente abre desde cualquier dispositivo, puede aceptar o rechazar, y descargar como PDF. El equipo gestiona el ciclo completo desde un unico panel: lead, cliente, proyecto, propuesta, factura cobrada, con seguimiento de interacciones, recordatorios y asistente IA.

Usuarios internos: Pol y Gerard, acceso total al dashboard.
Usuarios externos (clientes): acceso por URL con token UUID, sin login, sin cuenta.

---

## 2. Stack tecnico

### 2.1 Tecnologias principales

| Capa | Tecnologia | Version |
|---|---|---|
| Framework | Next.js App Router | 16.2.x |
| Bundler | Turbopack (default en Next 16) | — |
| Runtime | Node.js | 22.x LTS |
| Lenguaje | TypeScript strict | 5.7+ |
| Base de datos | Supabase PostgreSQL 17 | latest |
| Auth | Supabase Auth | - |
| Storage | Supabase Storage | - |
| Email | Resend + React Email | latest |
| Hosting | Vercel | - |
| Package manager | pnpm | 9.x |

### 2.2 Dependencias npm completas

Instalar con: pnpm add [paquete]

Produccion:
- next@^16.2, react@^19.2, react-dom@^19.2
- @supabase/supabase-js@^2, @supabase/ssr@^0.6
- resend@^4, @react-email/components@latest
- openai@^4
- zod@^3, react-hook-form@^7, @hookform/resolvers@^3
- @tanstack/react-table@^8
- @dnd-kit/core@^6, @dnd-kit/sortable@^8
- @tiptap/react@^3, @tiptap/starter-kit@^3, @tiptap/extension-placeholder@^3
- date-fns@^4, date-fns-tz@^3
- zustand@^5
- sonner@^2
- tailwindcss@^4, clsx@^2, tailwind-merge@^3, class-variance-authority@^0.7
- lucide-react@^0.4
- recharts@^2

Opcional (recomendado activar tras la primera versión estable):
- **React Compiler 1.0** (`babel-plugin-react-compiler`): activar `experimental.reactCompiler` en `next.config.ts` para auto-memoización de componentes sin `useMemo`/`useCallback` manuales.
- **Cache Components** (`use cache`, `cacheLife`, `cacheTag`): activar `cacheComponents: true` en `next.config.ts` para cachear directives a nivel de función/componente (KPIs del dashboard, filtros de tablas grandes).

# Verifactu / SIF (facturacion electronica AEAT)
- node-forge@^1           -- firma digital con certificado .p12 (FNMT/Camerfirma)
- fast-xml-parser@^4      -- generacion y parseo de XML segun XSD de AEAT
- qrcode@^1               -- generacion del codigo QR en PNG/SVG para facturas
- soap@^1                 -- cliente SOAP para el web service de AEAT (remision RF)

shadcn/ui components a instalar via CLI:
button, input, textarea, select, dialog, popover, dropdown-menu, calendar,
badge, card, table, tabs, separator, avatar, tooltip, skeleton, sheet,
command, form, label, switch, checkbox, progress, scroll-area

---

## 3. Design system

### 3.1 Filosofía visual

Referencias: **Vercel Dashboard** y **Notion**. Minimalismo funcional, no decorativo.

Principios:
- **Densidad informativa alta** sin sensación de saturación (whitespace generoso entre bloques, denso dentro de tablas).
- **Bordes 1px** sobre fondos planos en lugar de sombras pesadas. Sombras solo en elementos flotantes (popover, dialog, dropdown).
- **Radius consistente**: `--radius-sm: 6px` (badges, inputs), `--radius-md: 8px` (cards, buttons), `--radius-lg: 12px` (sheets, dialogs). Nada de "blob radius" tipo 24px+.
- **Color como señal, no decoración**: el grueso de la UI es gris/blanco; el color solo aparece en estados (success/warning/danger) y en badges de status.
- **Tipografía es la jerarquía**: el peso (400/500/600) y el tamaño hacen casi todo el trabajo; evitar separadores y subrayados decorativos.
- **Una sola acción primaria por pantalla**. El resto son `variant="secondary"` o `variant="ghost"`.

### 3.2 Modo claro y oscuro

Light mode por defecto (alineado con Notion/Vercel). Toggle a dark via `next-themes` respetando `prefers-color-scheme`. Ambos modos son first-class, ningún token hardcoded.

Tokens en `globals.css` con `@theme` de Tailwind 4:

```css
:root {
  /* Surfaces */
  --background:       #ffffff;
  --surface:          #fafafa;
  --surface-elevated: #ffffff;
  --surface-hover:    #f4f4f5;
  --border:           #e4e4e7;
  --border-strong:    #d4d4d8;

  /* Text */
  --text-primary:     #18181b;
  --text-secondary:   #52525b;
  --text-muted:       #a1a1aa;

  /* Accent (botón primario, links) — neutro tipo Vercel */
  --accent:           #18181b;
  --accent-hover:     #27272a;
  --accent-fg:        #fafafa;

  /* Status */
  --success:          #16a34a;
  --warning:          #ca8a04;
  --danger:           #dc2626;
  --info:             #2563eb;

  /* Lead temperature */
  --hot:              #dc2626;
  --warm:             #ea580c;
  --cold:             #2563eb;

  /* Focus ring */
  --ring:             #18181b;
}

.dark {
  --background:       #09090b;
  --surface:          #0c0c0e;
  --surface-elevated: #131316;
  --surface-hover:    #1c1c1f;
  --border:           #27272a;
  --border-strong:    #3f3f46;

  --text-primary:     #fafafa;
  --text-secondary:   #a1a1aa;
  --text-muted:       #71717a;

  --accent:           #fafafa;
  --accent-hover:     #e4e4e7;
  --accent-fg:        #18181b;

  --success:          #22c55e;
  --warning:          #eab308;
  --danger:           #ef4444;
  --info:             #3b82f6;

  --hot:              #ef4444;
  --warm:             #f97316;
  --cold:             #3b82f6;

  --ring:             #fafafa;
}
```

### 3.3 Tipografía

- font-family: `'Geist Sans', 'Inter', system-ui, sans-serif` (Geist es la tipografía de Vercel, optimizada para UI; fallback a Inter para compat con la landing).
- font-mono: `'Geist Mono', 'JetBrains Mono', monospace` (códigos, IDs, hashes Verifactu, importes en tablas con tabular-nums).
- Escala (Tailwind 4 `--text-*`):
  - `xs` 12px / labels, badges, captions de tabla
  - `sm` 13px / body en tablas, descripciones secundarias
  - `base` 14px / body por defecto (más denso que el web típico 16px)
  - `lg` 16px / títulos de sección
  - `xl` 18px / títulos de página
  - `2xl` 22px / KPIs medios
  - `3xl` 28px / KPI hero del dashboard
- Pesos: 400 body, 500 acciones y labels, 600 títulos. Nada de 700/800 (rompe el feel minimalista).
- `font-feature-settings: 'cv11', 'ss01', 'tnum'` para activar variantes de Geist y tabular nums por defecto.

### 3.4 Espaciado y grid

- Grid base de 4px (Tailwind defaults). Espacios obligatorios: `gap-2` (8px) dentro de cards, `gap-4` (16px) entre cards, `gap-6` (24px) entre secciones de página.
- Padding de página: `px-6 py-8` desktop, `px-4 py-6` tablet.
- Tablas: row height 40px (compacta) con padding-x 12px. Toolbar pegada a la tabla, sin gap.

### 3.5 Layout del dashboard

```
+------------------------------------------------------------------+
|  SIDEBAR 240px fijo (colapsable a 64px solo iconos en movil)    |
|  Logo doscientos | Nav items | Avatar usuario abajo              |
+------------------------------------------------------------------+
|  TOPBAR 56px | Breadcrumb | Buscador global | Campana badge      |
+------------------------------------------------------------------+
|  CONTENT AREA (overflow-y scroll, padding 24px)                 |
+------------------------------------------------------------------+
```

Sidebar nav items (en orden):
1. Inicio (KPIs y actividad reciente)
2. Leads (pipeline kanban)
3. Clientes
4. Proyectos
5. Propuestas
6. Facturas
7. Recordatorios (badge con count pendientes)
8. Documentos

---

## 4. Roles y acceso

```
TEAM (role: admin | member)
  Todos los team_members tienen acceso completo al dashboard.
  Solo admin puede: eliminar registros, ver configuracion, acceder a settings.

CLIENTE (sin cuenta, sin sesion)
  Accede SOLO por URL con public_token UUID (no adivinable).
  Puede ver: sus propuestas y sus facturas.
  Puede hacer: aceptar propuesta, rechazar propuesta con motivo, descargar PDF.
  No puede: ver otros clientes, navegar el CRM, ver precios de otros.
```

---

## 5. Modelo de datos (PostgreSQL via Supabase)

Convencion: todas las tablas tienen `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
y `created_at timestamptz NOT NULL DEFAULT now()`.
Los enums se validan en la capa de aplicacion con Zod (no ENUM de PostgreSQL para flexibilidad).

### 5.1 leads

```sql
id                    uuid PK
created_at            timestamptz
updated_at            timestamptz DEFAULT now()
name                  text NOT NULL
email                 text NOT NULL
phone                 text
company               text
budget                text        -- '<5k' | '5k-15k' | '15k-40k' | '>40k'
message               text
status                text        -- 'new' | 'contacted' | 'qualified' | 'lost' | 'converted'
source                text        -- 'landing' | 'referral' | 'manual'
utm_source            text
utm_medium            text
utm_campaign          text
referrer              text
ip                    text
device                text        -- 'desktop' | 'mobile' | 'tablet'
browser               text
language              text
assigned_to           uuid REFERENCES team_members(id)
notes                 text
converted_client_id   uuid REFERENCES clients(id)
-- Seguimiento
next_followup_at      timestamptz
last_interaction_at   timestamptz
interactions_count    int DEFAULT 0
-- IA
ai_summary              text
ai_suggested_next_step  text
ai_temperature          text      -- 'hot' | 'warm' | 'cold'
ai_confidence           numeric(3,2)
ai_updated_at           timestamptz
-- Soft delete (GDPR)
deleted_at              timestamptz  -- NULL = activo; non-NULL = borrado logico
```

Soft delete: todas las queries deben incluir `WHERE deleted_at IS NULL`.
Endpoint `DELETE /api/crm/leads/[id]` hace UPDATE deleted_at=now() en lugar de DELETE real.
Endpoint `POST /api/gdpr/leads/[id]/erase` anonimiza: name='ANONIMIZADO', email='anonimizado@gdpr.local', phone=null, ip=null, company=null, message=null.

### 5.2 clients

```sql
id          uuid PK
created_at  timestamptz
updated_at  timestamptz
lead_id     uuid REFERENCES leads(id)
name        text NOT NULL         -- nombre del contacto principal
company     text NOT NULL
email       text NOT NULL
phone       text
-- Datos fiscales (para factura legal)
nif         text                  -- NIF/CIF del cliente, obligatorio para facturar
address     text
city        text
postal_code text
country     text DEFAULT 'ES'
-- Extra
notes        text
status       text DEFAULT 'active' -- 'active' | 'inactive' | 'archived'
portal_token uuid UNIQUE DEFAULT gen_random_uuid() -- token para portal general del cliente (fase 2)
deleted_at   timestamptz  -- soft delete GDPR
```

### 5.3 projects

```sql
id          uuid PK
created_at  timestamptz
updated_at  timestamptz
client_id   uuid REFERENCES clients(id) NOT NULL
name        text NOT NULL
description text
status      text  -- 'discovery' | 'proposal' | 'active' | 'paused' | 'completed' | 'cancelled'
start_date  date
end_date    date
budget_total numeric(10,2)
assigned_to  uuid REFERENCES team_members(id)
public_token uuid UNIQUE DEFAULT gen_random_uuid() -- para portal de proyecto (fase 2)
```

### 5.4 project_milestones

Hitos de pago dentro de un proyecto. Permite facturacion parcial (ej: 50% inicio, 50% entrega).

```sql
id          uuid PK
created_at  timestamptz
project_id  uuid REFERENCES projects(id) NOT NULL
name        text NOT NULL  -- 'Inicio del proyecto', 'Entrega final'
percentage  numeric(5,2)   -- 50.00 = 50%
amount      numeric(10,2)  -- calculado: project.budget_total * percentage / 100
due_date    date
status      text DEFAULT 'pending' -- 'pending' | 'invoiced' | 'paid'
invoice_id  uuid REFERENCES invoices(id)
```

### 5.5 proposals (presupuestos)

```sql
id           uuid PK
created_at   timestamptz
updated_at   timestamptz
public_token uuid UNIQUE DEFAULT gen_random_uuid()
project_id   uuid REFERENCES projects(id)
client_id    uuid REFERENCES clients(id) NOT NULL
title        text NOT NULL
intro        text  -- texto introductorio antes de las lineas (markdown)
terms        text  -- condiciones, garantias, formas de pago (markdown)
status       text  -- 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
valid_until  date
subtotal     numeric(10,2)
tax_rate     numeric(5,2) DEFAULT 21.00  -- IVA %
tax_amount   numeric(10,2)
total        numeric(10,2)
currency     text DEFAULT 'EUR'
sent_at      timestamptz
accepted_at  timestamptz
rejected_at  timestamptz
rejection_reason text
-- Tracking de apertura por el cliente
view_count   int DEFAULT 0
first_viewed_at timestamptz
last_viewed_at  timestamptz
```

### 5.6 invoices (facturas)

```sql
id             uuid PK
created_at     timestamptz
updated_at     timestamptz
public_token   uuid UNIQUE DEFAULT gen_random_uuid()
proposal_id    uuid REFERENCES proposals(id)   -- null si es factura manual
project_id     uuid REFERENCES projects(id)
milestone_id   uuid REFERENCES project_milestones(id)
client_id      uuid REFERENCES clients(id) NOT NULL
invoice_number text UNIQUE NOT NULL             -- 'F-2026-001' generado automaticamente
status         text  -- 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
issue_date     date NOT NULL DEFAULT CURRENT_DATE
due_date       date NOT NULL
subtotal       numeric(10,2) NOT NULL
tax_rate       numeric(5,2) DEFAULT 21.00
tax_amount     numeric(10,2) NOT NULL
total          numeric(10,2) NOT NULL
currency       text DEFAULT 'EUR'
paid_at        timestamptz
payment_method text  -- 'transfer' | 'card' | 'cash' | 'other'
payment_ref    text  -- referencia de transferencia
notes          text
-- Tracking apertura por el cliente
view_count          int DEFAULT 0
first_viewed_at     timestamptz
last_viewed_at      timestamptz

-- Verifactu / SIF (RD 1007/2023)
invoice_type        text NOT NULL DEFAULT 'F1'
                                   -- 'F1' = factura normal | 'F2' = simplificada
                                   -- 'R1'..'R5' = rectificativa (segun art.15 RD 1619/2012)
                                   -- 'F3' = emitida en sustitución de facturas simplificadas
issued_at           timestamptz    -- timestamp exacto de emision (DD-MM-YYYYTHH:MM:SS±HH:MM, para hash)
-- Hash chain: garantia de inalterabilidad de la cadena de facturas
previous_hash       text NOT NULL DEFAULT '0'
                                   -- '0' (literal) en la primera factura del ejercicio; SHA-256 del registro anterior en el resto
current_hash        text           -- huella SHA-256 de este registro (calculada al emitir, inmutable)
chain_sequence      bigint         -- numero de orden dentro de la cadena correlativa
-- Estado de envio a la AEAT
verifactu_status    text DEFAULT 'pending'
                                   -- 'excluded'  -> factura en draft, no se envia
                                   -- 'pending'   -> emitida, pendiente de envio a AEAT
                                   -- 'sent'      -> enviada, esperando respuesta
                                   -- 'accepted'  -> AEAT la acepta y devuelve CSV
                                   -- 'rejected'  -> AEAT la rechaza (error de datos)
                                   -- 'error'     -> fallo de red, se reintentara
verifactu_sent_at   timestamptz    -- momento en que se envio a AEAT
verifactu_csv       text           -- Codigo Seguro de Verificacion devuelto por AEAT (32 chars)
verifactu_response  jsonb          -- respuesta cruda de AEAT (para auditoria y debugging)
verifactu_error     text           -- detalle del error si verifactu_status = 'rejected' | 'error'
verifactu_retry_count int DEFAULT 0 -- numero de reintentos realizados (max 5)
-- QR y verificacion publica
qr_url              text           -- URL que codifica el QR (sede.agenciatributaria.gob.es/...)
qr_png_url          text           -- URL del PNG del QR en Supabase Storage (para PDF)
-- Metadatos de emision (trazabilidad)
issued_by_user_id   uuid REFERENCES team_members(id)  -- quien emitio la factura
issued_from_ip      inet           -- IP del emisor en el momento de emision
sif_version         text DEFAULT 'crm-doscientos@1.0.0'  -- version del SIF que la genero
-- Facturas rectificativas (correccion de errores)
is_rectification    bool DEFAULT false  -- true si es una factura correctiva/abono
rectified_invoice_id uuid REFERENCES invoices(id)  -- factura original que corrige
rectification_reason text          -- motivo de la rectificacion
rectification_type  text           -- 'sustitucion' | 'diferencia' (segun RD 1619/2012 art.15)
-- Identificador Unico de Registro de Facturacion (IDFACT) — elemento visual obligatorio (art.9 HAC/1177/2024)
idfact              text UNIQUE    -- NIF_EMISOR + '-' + invoice_number + '-' + issued_at::date YYYYMMDD
-- Idempotencia (evitar doble facturación en reintentos de cron o red)
idempotency_key     text UNIQUE    -- UUID enviado por el cliente en header Idempotency-Key
```

IMPORTANTE — Inmodificabilidad (requisito SIF art. 8 RD 1007/2023):
Una vez que verifactu_status cambia de 'excluded' a cualquier otro valor (es decir, al emitir la factura),
el trigger `trg_invoice_immutable` lanza una excepcion si se intenta modificar cualquiera de los
campos fiscales protegidos: invoice_number, invoice_type, issue_date, issued_at, client_id, subtotal,
tax_rate, tax_amount, total, idfact, previous_hash, current_hash, chain_sequence, sif_version, issued_by_user_id.
Los line_items de una factura emitida tampoco pueden modificarse ni borrarse (RLS: DELETE vetado, UPDATE vetado si invoice.verifactu_status != 'excluded').
Para corregir un error se debe crear una factura rectificativa (is_rectification=true).

```sql
-- Trigger de inmodificabilidad de campos fiscales (RD 1007/2023 art. 8)
CREATE OR REPLACE FUNCTION fn_invoice_immutable() RETURNS trigger AS $$
BEGIN
  IF OLD.verifactu_status <> 'excluded' THEN
    IF (NEW.invoice_number   IS DISTINCT FROM OLD.invoice_number   OR
        NEW.invoice_type     IS DISTINCT FROM OLD.invoice_type     OR
        NEW.issue_date       IS DISTINCT FROM OLD.issue_date       OR
        NEW.issued_at        IS DISTINCT FROM OLD.issued_at        OR
        NEW.client_id        IS DISTINCT FROM OLD.client_id        OR
        NEW.subtotal         IS DISTINCT FROM OLD.subtotal         OR
        NEW.tax_rate         IS DISTINCT FROM OLD.tax_rate         OR
        NEW.tax_amount       IS DISTINCT FROM OLD.tax_amount       OR
        NEW.total            IS DISTINCT FROM OLD.total            OR
        NEW.idfact           IS DISTINCT FROM OLD.idfact           OR
        NEW.previous_hash    IS DISTINCT FROM OLD.previous_hash    OR
        NEW.current_hash     IS DISTINCT FROM OLD.current_hash     OR
        NEW.chain_sequence   IS DISTINCT FROM OLD.chain_sequence   OR
        NEW.sif_version      IS DISTINCT FROM OLD.sif_version      OR
        NEW.issued_by_user_id IS DISTINCT FROM OLD.issued_by_user_id)
    THEN
      RAISE EXCEPTION 'No se pueden modificar campos fiscales de una factura emitida (SIF RD 1007/2023)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoice_immutable
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION fn_invoice_immutable();
```

Logica de invoice_number: funcion PostgreSQL que genera el siguiente numero correlativo anual.
Formato: F-{YYYY}-{NNN} donde NNN es el numero secuencial del ano, con ceros a la izquierda.
Ejemplo: F-2026-001, F-2026-002, F-2027-001.

```sql
CREATE SEQUENCE invoice_seq_2026 START 1;

CREATE OR REPLACE FUNCTION next_invoice_number(year int)
RETURNS text AS $$
  SELECT 'F-' || year || '-' || lpad(nextval('invoice_seq_' || year)::text, 3, '0');
$$ LANGUAGE sql;
```

### 5.7 line_items

Aplica tanto a proposals como a invoices. Solo uno de los dos FKs es NOT NULL.

```sql
id          uuid PK
created_at  timestamptz
proposal_id uuid REFERENCES proposals(id)
invoice_id  uuid REFERENCES invoices(id)
-- CONSTRAINT: exactamente uno de los dos debe ser NOT NULL
description text NOT NULL
quantity    numeric(8,2) NOT NULL DEFAULT 1
unit_price  numeric(10,2) NOT NULL
total       numeric(10,2) NOT NULL  -- calculado: quantity * unit_price
sort_order  int NOT NULL DEFAULT 0
service_id  uuid REFERENCES services_catalog(id)  -- null si es linea libre
```

### 5.8 services_catalog

Catalogo de servicios reutilizables. El equipo lo configura una vez y los usa como line items rapidos.

```sql
id          uuid PK
created_at  timestamptz
name        text NOT NULL          -- 'Desarrollo frontend', 'Diseno UI', 'Hora de consultoria'
description text                   -- descripcion por defecto para la linea
unit_price  numeric(10,2)          -- precio por defecto (editable al usar)
unit        text DEFAULT 'proyecto' -- 'proyecto' | 'hora' | 'mes' | 'unidad'
is_active   bool DEFAULT true
category    text                   -- 'desarrollo' | 'diseno' | 'consultoria' | 'mantenimiento'
```

### 5.9 documents (documentos internos)

```sql
id               uuid PK
created_at       timestamptz
updated_at       timestamptz
project_id       uuid REFERENCES projects(id)
client_id        uuid REFERENCES clients(id)
author_id        uuid REFERENCES team_members(id)
type             text  -- 'brief' | 'contract' | 'nda' | 'meeting_notes' | 'spec' | 'other'
title            text NOT NULL
body             text  -- contenido markdown (via editor Tiptap)
file_url         text  -- si es archivo adjunto (Supabase Storage)
file_name        text
file_size_bytes  int
is_client_visible bool DEFAULT false  -- si aparece en el portal del cliente
```

### 5.10 email_templates

Plantillas de email reutilizables para enviar desde el CRM. Soportan variables de interpolacion.

```sql
id          uuid PK
created_at  timestamptz
name        text NOT NULL          -- 'Seguimiento tras primera llamada'
subject     text NOT NULL          -- 'Hola {{nombre}}, te escribo sobre...'
body        text NOT NULL          -- markdown con variables: {{nombre}}, {{empresa}}, {{link_propuesta}}
category    text                   -- 'follow_up' | 'proposal' | 'invoice' | 'onboarding' | 'other'
include_signature bool DEFAULT true -- si se añade la firma del usuario al final
is_active   bool DEFAULT true
use_count   int DEFAULT 0          -- cuantas veces se ha usado
```

Variables disponibles: {{nombre}}, {{empresa}}, {{email}}, {{link_propuesta}}, {{link_factura}}, {{nombre_proyecto}}, {{total}}, {{fecha_vencimiento}}.

### 5.11 activities (audit log global)

Registro automatico de todos los eventos del sistema. No se edita manualmente.

```sql
id          uuid PK
created_at  timestamptz
entity_type text NOT NULL  -- 'lead' | 'client' | 'project' | 'proposal' | 'invoice'
entity_id   uuid NOT NULL
action      text NOT NULL  -- 'created' | 'updated' | 'status_changed' | 'email_sent' | 'viewed' | 'accepted' | 'rejected' | 'paid'
actor_type  text NOT NULL  -- 'team' | 'client' | 'system'
actor_id    uuid           -- team_member id o null si es cliente/sistema
metadata    jsonb          -- datos extra: {old_status, new_status, ip, email_subject, ...}
```

### 5.12 team_members

```sql
id            uuid PK       -- debe coincidir con el user id de Supabase Auth
created_at    timestamptz
name          text NOT NULL
email         text NOT NULL UNIQUE
email_alias   text          -- email visible al lead (ej: pol@doscientos.es)
signature_html text         -- firma HTML/markdown para emails
role          text NOT NULL DEFAULT 'member'
-- Roles (jerarquía):
-- 'owner'  -> acceso total + billing + borrar empresa + Verifactu cert
-- 'admin'  -> acceso total excepto billing y borrado de empresa
-- 'member' -> acceso a proyectos/tareas/leads asignados o de equipo; NO ve settings financieros
-- 'viewer' -> solo lectura, sin crear ni editar nada
avatar_url    text
is_active     bool DEFAULT true
email_send_enabled bool DEFAULT true -- permite al usuario enviar emails desde el CRM
github_handle text UNIQUE           -- handle de GitHub para sincronización bidireccional
deleted_at    timestamptz           -- soft delete: NULL = activo
mfa_enabled   bool DEFAULT false    -- refleja si el usuario tiene TOTP activo en Supabase Auth
```

Restricción: solo puede haber 1 `owner`. El owner no puede degradarse a sí mismo
(validado en API route, no en RLS para evitar lockout).

### 5.13 lead_interactions

Registro manual de cada contacto real con un lead.

```sql
id            uuid PK
created_at    timestamptz
lead_id       uuid REFERENCES leads(id) NOT NULL
author_id     uuid REFERENCES team_members(id) NOT NULL
type          text NOT NULL  -- 'call' | 'email_sent' | 'email_received' | 'whatsapp' | 'meeting' | 'note'
outcome       text           -- 'no_answer' | 'voicemail' | 'interested' | 'not_interested' | 'follow_up' | 'converted'
title         text NOT NULL  -- asunto corto: 'Llamada inicial', 'Email de seguimiento'
body          text           -- notas libres (markdown)
duration_min  int            -- duracion en minutos (llamadas y reuniones)
contacted_at  timestamptz DEFAULT now()  -- fecha real del contacto (puede ser distinta a created_at)
resend_email_id text         -- ID del email en Resend (solo si type = email_sent)
is_internal   bool DEFAULT true  -- false = visible en portal cliente
```

Triggers de base de datos al insertar:
- Incrementar leads.interactions_count
- Actualizar leads.last_interaction_at = contacted_at

### 5.14 reminders

```sql
id            uuid PK
created_at    timestamptz
lead_id       uuid REFERENCES leads(id)    -- uno de los dos NOT NULL
client_id     uuid REFERENCES clients(id)  -- uno de los dos NOT NULL
assigned_to   uuid REFERENCES team_members(id) NOT NULL
title         text NOT NULL   -- 'Llamar a Marta para confirmar presupuesto'
due_at        timestamptz NOT NULL
type          text  -- 'call' | 'email' | 'meeting' | 'task' | 'other'
priority      text DEFAULT 'medium'  -- 'low' | 'medium' | 'high'
status        text DEFAULT 'pending' -- 'pending' | 'done' | 'snoozed' | 'cancelled'
done_at       timestamptz
snoozed_until timestamptz
interaction_id uuid REFERENCES lead_interactions(id)  -- si se resolvio al registrar interaccion
```

Trigger al insertar reminder: actualizar leads.next_followup_at con el due_at mas proximo pendiente.

### 5.15 subscriptions (facturacion recurrente)

Contratos de mantenimiento, hosting, retainers mensuales y cualquier servicio facturado de forma periodica. Cada subscription activa genera facturas automaticamente segun su ciclo.

```sql
id                 uuid PK
created_at         timestamptz
updated_at         timestamptz
client_id          uuid REFERENCES clients(id) NOT NULL
project_id         uuid REFERENCES projects(id)  -- opcional, puede no estar ligada a proyecto
name               text NOT NULL          -- 'Mantenimiento web mensual', 'Hosting + SLA'
description        text                   -- descripcion que aparecera en la factura
amount             numeric(10,2) NOT NULL -- importe por ciclo, sin IVA
tax_rate           numeric(5,2) DEFAULT 21.00
currency           text DEFAULT 'EUR'
-- Ciclo de facturacion
billing_cycle      text NOT NULL          -- 'monthly' | 'quarterly' | 'biannual' | 'annual'
billing_day        int DEFAULT 1          -- dia del mes para emitir (1-28, max 28 para evitar problemas en feb)
-- Vigencia
start_date         date NOT NULL
end_date           date                   -- null = indefinida
next_invoice_date  date NOT NULL          -- proxima fecha en que se generara factura
last_invoiced_at   timestamptz
-- Estado
status             text DEFAULT 'active'  -- 'active' | 'paused' | 'cancelled'
cancelled_at       timestamptz
cancellation_reason text
-- Configuracion del envio
auto_generate      bool DEFAULT true      -- si false, queda en draft a la espera de revision manual
auto_send_email    bool DEFAULT false     -- si true, envia email al cliente automaticamente; si false, solo prepara
payment_terms_days int DEFAULT 30         -- dias para due_date desde issue_date
notes              text                   -- notas internas
```

Logica de next_invoice_date al crear:
- monthly: start_date + 1 mes (mismo billing_day)
- quarterly: start_date + 3 meses
- biannual: start_date + 6 meses
- annual: start_date + 12 meses

Tras generar una factura, next_invoice_date se recalcula automaticamente sumando el ciclo.

### 5.16 subscription_invoices (relacion N:1 con invoices)

Tabla pivote que conecta facturas generadas con su suscripcion origen.
Se anade columna `subscription_id uuid REFERENCES subscriptions(id)` directamente en `invoices` (mas simple que tabla pivote, ya que una factura pertenece a una sola suscripcion).

Actualizacion de la tabla invoices (seccion 5.6) - anadir campos:
```sql
subscription_id    uuid REFERENCES subscriptions(id)  -- null si no es recurrente
billing_period_start date                              -- ej: 2026-06-01
billing_period_end   date                              -- ej: 2026-06-30
is_recurring        bool DEFAULT false
```

### 5.17 invoice_events (log inmutable de eventos)

Tabla de auditoria append-only. Registra cada evento relevante sobre una factura: emision, envio, aceptacion, rechazo, rectificacion. Cumple el requisito de trazabilidad del RD 1007/2023 art.6.

```sql
CREATE TABLE invoice_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  invoice_id      uuid REFERENCES invoices(id) NOT NULL,
  event_type      text NOT NULL,
  -- Tipos de evento:
  -- 'issued'          -> factura emitida (sale de draft)
  -- 'sent_to_client'  -> enviada al cliente por email
  -- 'viewed_by_client'-> el cliente abrio el portal
  -- 'paid'            -> marcada como pagada
  -- 'verifactu_sent'  -> enviada a AEAT
  -- 'verifactu_accepted' -> aceptada por AEAT (CSV recibido)
  -- 'verifactu_rejected' -> rechazada por AEAT
  -- 'rectified'       -> se creo una factura rectificativa de esta
  -- 'cancelled'       -> cancelada (sin rectificativa)
  actor_id        uuid REFERENCES team_members(id),  -- null si es evento automatico (cron)
  actor_ip        inet,
  actor_type      text DEFAULT 'user',  -- 'user' | 'cron' | 'system'
  payload         jsonb  -- datos adicionales del evento (ej: CSV de AEAT, motivo de rechazo)
);

-- La tabla es APPEND-ONLY: prohibir UPDATE y DELETE via RLS y trigger
CREATE POLICY "no_update_invoice_events" ON invoice_events
  FOR UPDATE USING (false);

CREATE POLICY "no_delete_invoice_events" ON invoice_events
  FOR DELETE USING (false);

CREATE POLICY "team_insert_invoice_events" ON invoice_events
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "system_insert_invoice_events" ON invoice_events
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "team_read_invoice_events" ON invoice_events
  FOR SELECT TO authenticated USING (true);
```

---

### 5.18 tasks

Tareas vinculadas a proyecto o a lead. Soporta subtareas (parent_task_id), prioridades,
etiquetas (tabla task_tags), sincronización GitHub y time tracking via time_entries.

```sql
CREATE TABLE tasks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- Relaciones (al menos uno de project_id o lead_id debe ser NOT NULL)
  project_id        uuid REFERENCES projects(id),           -- null solo si lead_id IS NOT NULL
  lead_id           uuid REFERENCES leads(id),              -- tarea de seguimiento de lead sin proyecto
  milestone_id      uuid REFERENCES milestones(id),
  parent_task_id    uuid REFERENCES tasks(id),              -- null = raiz; non-null = subtarea
  assignee_id       uuid REFERENCES team_members(id),

  CONSTRAINT tasks_context_check CHECK (
    project_id IS NOT NULL OR lead_id IS NOT NULL
  ),

  -- Contenido
  title             text NOT NULL,
  description       text,                                   -- Markdown, renderizado con react-markdown
  status            text NOT NULL DEFAULT 'todo',
  -- 'todo'        -> pendiente
  -- 'in_progress' -> en curso
  -- 'in_review'   -> esperando revision (activo solo si project.github_repo_url IS NOT NULL)
  -- 'done'        -> completada
  -- 'cancelled'   -> cancelada sin completar

  priority          text NOT NULL DEFAULT 'medium',
  -- 'urgent' | 'high' | 'medium' | 'low'

  -- Fechas
  due_date          date,
  started_at        timestamptz,
  completed_at      timestamptz,
  estimated_hours   numeric(6,2),

  -- Orden Kanban con fractional indexing (LexoRank-style).
  -- Librería: https://github.com/rocicorp/fractional-indexing
  -- Valor inicial: 'a0'. Insertar entre dos elementos: midpoint(prev, next).
  -- Nunca se recalcula en bulk; solo se actualiza la fila movida.
  kanban_order      text NOT NULL DEFAULT 'a0',

  -- GitHub sync
  github_issue_number int,
  github_issue_url    text,
  github_pr_number    int,                                  -- PR que cierra esta tarea
  github_pr_url       text,
  github_synced_at    timestamptz,

  -- Metadatos
  is_billable       bool DEFAULT true,                      -- si el tiempo registrado es facturable
  deleted_at        timestamptz                             -- soft delete
);

CREATE INDEX idx_tasks_project_id ON tasks(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_tasks_lead_id ON tasks(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_kanban ON tasks(project_id, status, kanban_order);
CREATE INDEX idx_tasks_github_issue ON tasks(github_issue_number) WHERE github_issue_number IS NOT NULL;
```

### 5.19 task_comments

Comentarios por tarea con soporte de menciones a team_members (@handle).
Una mención genera una notificación en tiempo real y un email si el usuario está desconectado.

```sql
CREATE TABLE task_comments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  task_id         uuid REFERENCES tasks(id) NOT NULL,
  author_id       uuid REFERENCES team_members(id) NOT NULL,
  body            text NOT NULL,                            -- Markdown con soporte @menciones
  mentions        uuid[] DEFAULT '{}',                      -- IDs de team_members mencionados
  edited          bool DEFAULT false,

  -- Origen del comentario (puede venir de GitHub)
  source          text DEFAULT 'crm',                       -- 'crm' | 'github'
  github_comment_id bigint                                  -- ID del comment en GitHub API
);

CREATE INDEX idx_task_comments_task_id ON task_comments(task_id);
```

### 5.20 task_attachments (Phase 2)

Tabla diferida para MVP. En MVP los archivos se adjuntan pegando URLs o usando Supabase Storage
directamente desde el comentario (drag-and-drop a `task_comments.body` como enlace markdown).
La tabla se define aquí para que el schema esté completo, pero la UI de upload se implementa tras validar
que el equipo realmente adjunta archivos frecuentemente.

```sql
-- Phase 2: implementar cuando el volumen de adjuntos lo justifique
CREATE TABLE task_attachments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  task_id         uuid REFERENCES tasks(id) NOT NULL,
  uploaded_by     uuid REFERENCES team_members(id) NOT NULL,
  filename        text NOT NULL,
  storage_path    text NOT NULL,  -- bucket: task-files/{task_id}/{filename}
  mime_type       text,
  size_bytes      bigint
);
```

### 5.22 task_tags

Etiquetas tipadas por proyecto con color. Sustituye el campo `tags text[]` eliminado de `tasks`.
Permite filtrado por color, autocompletado y reutilización entre tareas del mismo proyecto.

```sql
CREATE TABLE task_tags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) NOT NULL,
  name       text NOT NULL,          -- 'bug', 'feature', 'design', 'backend'
  color      text NOT NULL DEFAULT '#6366f1',  -- hex color

  UNIQUE (project_id, name)
);

-- Relación N:M tasks <-> task_tags
CREATE TABLE task_tag_assignments (
  task_id    uuid REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id     uuid REFERENCES task_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

CREATE INDEX idx_tag_assignments_task ON task_tag_assignments(task_id);
CREATE INDEX idx_tag_assignments_tag ON task_tag_assignments(tag_id);
```

### 5.23 time_entries

Registro de tiempo trabajado por tarea. Es el núcleo del time tracking y la facturación por horas.

```sql
CREATE TABLE time_entries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- Contexto
  task_id          uuid REFERENCES tasks(id),              -- null = tiempo de proyecto sin tarea específica
  project_id       uuid REFERENCES projects(id) NOT NULL,
  member_id        uuid REFERENCES team_members(id) NOT NULL,

  -- Tiempo
  started_at       timestamptz NOT NULL,
  ended_at         timestamptz,                            -- null = timer corriendo actualmente
  duration_minutes int GENERATED ALWAYS AS (
    CASE WHEN ended_at IS NOT NULL
         THEN EXTRACT(EPOCH FROM (ended_at - started_at)) / 60
         ELSE NULL
    END
  ) STORED,

  -- Descripción
  description      text,                                   -- resumen de qué se hizo

  -- Facturación
  is_billable      bool NOT NULL DEFAULT true,
  hourly_rate      numeric(10,2),                          -- snapshot del rate en el momento de cerrar
  -- Cuándo se factura esta entrada:
  invoiced_at      timestamptz,                            -- null = pendiente de facturar
  invoice_id       uuid REFERENCES invoices(id)            -- null hasta que se incluya en factura
);

CREATE INDEX idx_time_entries_project ON time_entries(project_id);
CREATE INDEX idx_time_entries_member ON time_entries(member_id);
CREATE INDEX idx_time_entries_task ON time_entries(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX idx_time_entries_uninvoiced ON time_entries(project_id, is_billable)
  WHERE invoiced_at IS NULL AND ended_at IS NOT NULL;
```

**Flujo de facturación de horas:**
1. Al cerrar el proyecto o a demanda: botón "Importar horas no facturadas" en `/projects/[id]/invoices`.
2. La API lee `time_entries WHERE project_id = X AND is_billable = true AND invoiced_at IS NULL AND ended_at IS NOT NULL`.
3. Agrupa por `member_id`, calcula `duration_minutes * hourly_rate / 60`.
4. Genera `line_items` en la nueva factura con descripción "Horas [Nombre] — [periodo]".
5. UPDATE `time_entries.invoiced_at = now(), invoice_id = nueva_factura.id`.

**Timer activo:**
- Solo puede haber 1 `time_entry` con `ended_at IS NULL` por `member_id` a la vez (validado en API route).
- UI: botón "▶ Iniciar" en el TaskSheet. Badge en la sidebar cuando hay un timer corriendo.

### 5.24 notification_preferences

Controla qué notificaciones recibe cada miembro y por qué canal, evitando que los usuarios
desactiven toda notificación por saturación de emails innecesarios.

```sql
CREATE TABLE notification_preferences (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid REFERENCES team_members(id) NOT NULL,
  event_type  text NOT NULL,
  -- Tipos de evento:
  -- 'new_lead'             -> lead nuevo desde landing
  -- 'lead_assigned'        -> lead asignado a mí
  -- 'reminder_due'         -> recordatorio vence hoy
  -- 'proposal_viewed'      -> cliente vio propuesta
  -- 'proposal_accepted'    -> cliente aceptó propuesta
  -- 'invoice_overdue'      -> factura vencida
  -- 'task_assigned'        -> tarea asignada a mí
  -- 'task_mention'         -> @mencionado en comentario
  -- 'milestone_completed'  -> milestone llega al 100%
  -- 'verifactu_error'      -> fallo en envío a AEAT
  -- 'subscription_ending'  -> suscripción próxima a vencer
  channel     text NOT NULL,  -- 'email' | 'in_app'
  enabled     bool NOT NULL DEFAULT true,

  UNIQUE (member_id, event_type, channel)
);

-- Defaults por rol (insertar al crear team_member):
-- owner/admin: todos los eventos, ambos canales
-- member: task_assigned + task_mention + reminder_due en ambos canales; resto desactivado
-- viewer: solo in_app, ningún email
```

### 5.21 milestones (ampliada)

Los milestones existían solo para representar pagos parciales de proyecto.
Se amplían para ser hitos de planificación propios, desacoplando el concepto de "entrega" del de "cobro".
Un milestone puede tener: tareas asociadas, fecha objetivo, y opcionalmente un pago vinculado.

```sql
-- Columnas nuevas sobre la definicion existente de milestones:
ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS description text,               -- descripcion del hito
  ADD COLUMN IF NOT EXISTS start_date  date,               -- fecha de inicio planificada
  ADD COLUMN IF NOT EXISTS completion_percentage int DEFAULT 0,  -- calculado por trigger (% tareas done)
  ADD COLUMN IF NOT EXISTS color       text DEFAULT '#6366f1',   -- color en la vista Gantt
  ADD COLUMN IF NOT EXISTS github_milestone_number int,    -- numero del milestone en GitHub
  ADD COLUMN IF NOT EXISTS is_payment_milestone bool DEFAULT false; -- true si genera factura al completarse
-- Las columnas de pago (amount, invoice_id) ya existian en la definicion original
```

---

## 6. Seguridad y RLS (Row Level Security)

Todas las tablas tienen RLS activado. El service_role_key solo se usa en API routes del servidor, nunca en el cliente.

### 6.1 Politicas por tabla

Las políticas RLS reflejan el modelo de roles: `owner > admin > member > viewer`.
El rol se lee con `(SELECT role FROM team_members WHERE id = auth.uid())`.
Para evitar N+1 en cada evaluación de política, se usa una función helper estable:

```sql
CREATE OR REPLACE FUNCTION current_member_role()
RETURNS text STABLE LANGUAGE sql AS $$
  SELECT role FROM team_members WHERE id = auth.uid() AND deleted_at IS NULL LIMIT 1;
$$;
```

```sql
-- El portal publico accede via service_role en API routes, nunca directamente

-- leads: todos leen; solo member+ escribe; solo admin+ borra (soft delete)
CREATE POLICY "read_leads"   ON leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "write_leads"  ON leads FOR INSERT TO authenticated WITH CHECK (current_member_role() IN ('owner','admin','member'));
CREATE POLICY "update_leads" ON leads FOR UPDATE TO authenticated USING (current_member_role() IN ('owner','admin','member'));
CREATE POLICY "delete_leads" ON leads FOR DELETE TO authenticated USING (current_member_role() IN ('owner','admin'));

-- proposals: lectura publica por token via service_role; escritura solo member+
CREATE POLICY "team_all_proposals" ON proposals FOR ALL TO authenticated
  USING (current_member_role() IN ('owner','admin','member'))
  WITH CHECK (current_member_role() IN ('owner','admin','member'));

-- invoices: member+ crea; admin+ puede anular (status='cancelled'); owner+ accede a settings fiscales
CREATE POLICY "team_read_invoices"   ON invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_insert_invoices" ON invoices FOR INSERT TO authenticated
  WITH CHECK (current_member_role() IN ('owner','admin','member'));
CREATE POLICY "team_update_invoices" ON invoices FOR UPDATE TO authenticated
  USING (current_member_role() IN ('owner','admin','member'));
-- Borrar facturas: NUNCA permitido por RLS (Verifactu - integridad legal).
CREATE POLICY "no_delete_invoices" ON invoices FOR DELETE USING (false);

-- activities: todos leen; solo service_role inserta (los triggers lo hacen server-side)
CREATE POLICY "team_read_activities"   ON activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "system_insert_activities" ON activities FOR INSERT TO service_role WITH CHECK (true);

-- email_templates, services_catalog: member+ escribe
CREATE POLICY "team_all_templates" ON email_templates FOR ALL TO authenticated
  USING (current_member_role() IN ('owner','admin','member'))
  WITH CHECK (current_member_role() IN ('owner','admin','member'));
CREATE POLICY "viewer_read_templates" ON email_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "team_all_services" ON services_catalog FOR ALL TO authenticated
  USING (current_member_role() IN ('owner','admin','member'))
  WITH CHECK (current_member_role() IN ('owner','admin','member'));

-- tasks, task_comments: member+ escribe; viewer solo lee
CREATE POLICY "read_tasks"  ON tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "write_tasks" ON tasks FOR ALL TO authenticated
  USING (current_member_role() IN ('owner','admin','member'))
  WITH CHECK (current_member_role() IN ('owner','admin','member'));

CREATE POLICY "read_task_comments"  ON task_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "write_task_comments" ON task_comments FOR ALL TO authenticated
  USING (current_member_role() IN ('owner','admin','member'))
  WITH CHECK (current_member_role() IN ('owner','admin','member'));

CREATE POLICY "read_task_attachments"  ON task_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "write_task_attachments" ON task_attachments FOR ALL TO authenticated
  USING (current_member_role() IN ('owner','admin','member'))
  WITH CHECK (current_member_role() IN ('owner','admin','member'));

-- time_entries: cada miembro ve/edita las suyas; admin+ ve todas
CREATE POLICY "read_own_time_entries" ON time_entries FOR SELECT TO authenticated
  USING (member_id = auth.uid() OR current_member_role() IN ('owner','admin'));
CREATE POLICY "write_own_time_entries" ON time_entries FOR ALL TO authenticated
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

-- notification_preferences: cada miembro gestiona las suyas
CREATE POLICY "own_notification_prefs" ON notification_preferences FOR ALL TO authenticated
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

-- task_tags + task_tag_assignments: member+ gestiona
CREATE POLICY "team_all_task_tags" ON task_tags FOR ALL TO authenticated
  USING (current_member_role() IN ('owner','admin','member'))
  WITH CHECK (current_member_role() IN ('owner','admin','member'));
CREATE POLICY "read_task_tags" ON task_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_all_tag_assignments" ON task_tag_assignments FOR ALL TO authenticated
  USING (current_member_role() IN ('owner','admin','member'))
  WITH CHECK (current_member_role() IN ('owner','admin','member'));

-- team_members: todos leen (para menciones, asignaciones); solo owner/admin edita roles
CREATE POLICY "read_team_members" ON team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write_team" ON team_members FOR ALL TO authenticated
  USING (current_member_role() IN ('owner','admin'))
  WITH CHECK (current_member_role() IN ('owner','admin'));
```

### 6.1.1 2FA para owner y admin

Supabase Auth soporta TOTP nativo (`auth.mfa_factors`).
El `proxy.ts` de Next.js 16 (sustituye al antiguo `middleware.ts`) verifica `auth.aal()` (Assurance Level):

```typescript
// proxy.ts (Next 16+, antes middleware.ts)
const { data: { user } } = await supabase.auth.getUser()
const role = await getCurrentRole(user.id) // query a team_members

if (['owner', 'admin'].includes(role)) {
  const { data: { aal } } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.currentLevel !== 'aal2') {
    return NextResponse.redirect(new URL('/login/mfa', request.url))
  }
}
```

Configuración en settings: `/settings/security` con QR de TOTP y botón de activación.
Los `member` y `viewer` tienen 2FA opcional.

### 6.2 Acceso del portal publico

Las rutas /p/[tipo]/[token] son Next.js Server Components que:
1. Reciben el token de la URL
2. Hacen una query server-side con el supabaseAdmin (service_role)
3. Validan que el token existe y el documento no esta cancelado
4. Si no existe: redirect a /p/not-found (pagina generica sin info)
5. Nunca exponen el anon_key ni la estructura interna en el cliente

Rate limiting en rutas del portal: 30 req/min por IP (lru-cache en memoria, sec. 27).

**Qué ve el cliente en el portal:**
- Sus propuestas (`/p/proposal/[token]`): aceptar, rechazar, descargar PDF.
- Sus facturas (`/p/invoice/[token]`): ver, descargar PDF, QR Verifactu.
- **NO ve** tareas ni comentarios internos del equipo.
- **SÍ ve** milestones (si se implementa portal de proyecto en Phase 2): solo `name`,
  `due_date` y `completion_percentage` — nunca los comentarios ni detalles de tareas.

### 6.3 Proxy de autenticacion (antes `middleware.ts`)

A partir de Next.js 16 el archivo se llama `proxy.ts` (la convención `middleware.ts` está deprecated). La API es prácticamente idéntica.

```typescript
// proxy.ts
export const config = {
  matcher: ['/(dashboard)/:path*', '/api/crm/:path*']
}
// Rutas protegidas: todo bajo /(dashboard) y /api/crm
// Rutas publicas: /login, /p/:path*, /api/portal/:path*
```

---

## 7. Cumplimiento fiscal Espana

### 7.1 Requisitos legales de factura (Espana)

Segun el articulo 6 del Real Decreto 1619/2012, una factura valida en Espana debe contener:

1. Numero de factura: correlativo y sin saltos (F-2026-001, F-2026-002...)
2. Fecha de emision
3. Datos del emisor: nombre/razon social, NIF, domicilio
4. Datos del receptor: nombre/razon social, NIF, domicilio (si es empresa o autonomo)
5. Descripcion de los servicios prestados
6. Base imponible (subtotal sin IVA)
7. Tipo de IVA aplicado (21% servicios digitales generalmente)
8. Cuota de IVA (importe del IVA)
9. Total a pagar

### 7.2 Datos del emisor (fijos en el sistema)

```typescript
const EMISOR = {
  razon_social: 'DOSCIENTOS DESARROLLO TECNOLOGICO, S.L.',
  nif: '',          // rellenar antes de produccion
  domicilio: '',    // rellenar antes de produccion
  ciudad: 'Barcelona',
  cp: '',
  pais: 'ES',
  email: 'hola@doscientos.es',
  iban: '',         // para indicar cuenta bancaria en la factura
}
```

Estos datos se guardan en una tabla `settings` (clave-valor) configurable desde la app:

```sql
CREATE TABLE settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);
-- Claves: emisor_razon_social, emisor_nif, emisor_domicilio, emisor_ciudad, emisor_cp, emisor_iban
```

### 7.3 IRPF

DOSCIENTOS DESARROLLO TECNOLOGICO, S.L. es una Sociedad Limitada.
Las SL NO aplican retencion de IRPF en sus facturas.
El sistema NO debe incluir campo de IRPF en las facturas.
Documentado aqui para evitar confusion al implementar.

### 7.4 Numeracion correlativa

La secuencia de facturas es anual y correlativa. No puede haber saltos.
Si una factura se cancela, se anota como 'cancelled' pero el numero NO se reutiliza.
La funcion next_invoice_number() (definida en seccion 5.6) garantiza esto.
Las facturas en borrador ('draft') NO consumen numero; el numero se asigna al cambiar a 'sent'.

### 7.5 Conservacion de facturas

Obligacion legal: conservar facturas durante 5 anios.
El sistema no puede eliminar facturas, solo cancelarlas (status: 'cancelled').
Los admins no tienen permiso de DELETE en la tabla invoices, solo UPDATE.

### 7.6 Cumplimiento Verifactu / SIF (RD 1007/2023)

#### Contexto legal

El Real Decreto 1007/2023 y la Orden HAC/1177/2024 obligan a todas las empresas
con domicilio fiscal en Espana a usar un Sistema Informatico de Facturacion (SIF)
que garantice la integridad, inalterabilidad y trazabilidad de los registros de facturacion.

Plazo para DOSCIENTOS DESARROLLO TECNOLOGICO, S.L. (sujeto al IS): 1 enero 2027.
El servicio de la AEAT esta en produccion desde el 23 de abril de 2025 y acepta
envios voluntarios desde esa fecha. Se recomienda activarlo en cuanto el CRM este listo.

Modalidad elegida: VERI*FACTU (envio en tiempo real a la AEAT).
Ventaja frente a No-Verifactu: menor carga tecnica interna (la AEAT avala la inalterabilidad),
QR verificable por el cliente en sede.agenciatributaria.gob.es, y menor riesgo de sancion.

#### 7.6.1 Hash chain (cadena de huellas)

Cada factura emitida debe incluir una huella SHA-256 que encadena el registro con el anterior.
Si alguien modifica o borra una factura, la huella del siguiente registro dejaria de coincidir,
lo que hace la manipulacion detectable por la AEAT.

Campos implicados en el calculo del hash (segun Anexo I de la Orden HAC/1177/2024):
- NIF del emisor
- Numero de factura
- Fecha de expedicion
- Tipo de factura (F1 = normal, R1-R5 = rectificativa)
- Cuota de IVA
- Total de la factura
- Huella del registro anterior (previous_hash)
- Fecha y hora de generacion del registro (timestamp ISO 8601)

```typescript
// lib/verifactu/hash.ts
import { createHash } from 'crypto'

export function computeInvoiceHash(fields: {
  nif_emisor: string        // NIF sin separadores, ej: 'B12345678'
  invoice_number: string    // numero completo, ej: 'F-2026-001'
  issue_date: string        // formato exacto 'DD-MM-YYYY' (Anexo I HAC/1177/2024)
  invoice_type: string      // 'F1' | 'F2' | 'F3' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5'
  tax_amount: string        // CuotaTotal: suma de cuotas IVA, 2 decimales, ej: '21.00'
  total: string             // ImporteTotal, 2 decimales, ej: '121.00'
  previous_hash: string     // '0' si es la primera factura del ejercicio; hex del anterior en el resto
  generated_at: string      // FechaHoraHusoHorarioFirma: 'DD-MM-YYYYTHH:MM:SS+01:00'
}): string {
  // Orden y separador exactos segun Anexo I de la Orden HAC/1177/2024
  // Los campos se concatenan con '&' como separador
  const canonical = [
    fields.nif_emisor,
    fields.invoice_number,
    fields.issue_date,
    fields.invoice_type,
    fields.tax_amount,
    fields.total,
    fields.previous_hash,   // nunca null: '0' para primera factura
    fields.generated_at,
  ].join('&')

  return createHash('sha256').update(canonical, 'utf8').digest('hex').toUpperCase()
}
```

Notas críticas de implementación:
- `previous_hash` de la **primera factura** del ejercicio es el string literal `'0'` (no cadena vacía, no null).
- `issue_date` para el hash siempre en `DD-MM-YYYY` aunque la BD lo almacene como `date` (ISO).
- `generated_at` es `issued_at` de la factura formateado con timezone explícito (`+01:00` o `+02:00` según DST).
- Si la AEAT rechaza el registro, el hash **no cambia** — la factura queda inmodificable y hay que emitir una rectificativa.

#### 7.6.2 Firma digital y envio XML a la AEAT

El registro de facturacion debe firmarse con el certificado digital de la empresa
(representante de persona juridica emitido por FNMT o Camerfirma) antes de enviarse.

El certificado se almacena como variable de entorno en Vercel (nunca en el repo):
- VERIFACTU_CERT_P12_BASE64: certificado .p12 codificado en base64
- VERIFACTU_CERT_PASSWORD: contrasena del .p12

Modulos necesarios en lib/verifactu/:

```
lib/verifactu/
  hash.ts       -- computeInvoiceHash() descrito arriba
  xml.ts        -- buildRegistroFacturacion() -> XML segun XSD de AEAT
  sign.ts       -- signXml() -> firma el XML con node-forge usando el certificado
  client.ts     -- sendToAeat() -> cliente SOAP, envia a AEAT, parsea respuesta
  qr.ts         -- buildQrUrl() + generateQrPng() -> URL y PNG del QR tributario
  utils.ts      -- formatDecimal(), formatDate(), getLastInvoiceHash()
```

Endpoints AEAT (SOAP over HTTPS):
- Test (homologacion): https://prewww1.aeat.es/wlpl/TIKE-WFCS/ws/VeriFactu/RecepcionFacturas
- Produccion:          https://www1.aeat.es/wlpl/TIKE-WFCS/ws/VeriFactu/RecepcionFacturas

La variable `VERIFACTU_ENV = 'mock' | 'test' | 'prod'` determina cuál usar:

- **`mock`** (default en desarrollo y mientras no haya certificado sandbox FNMT): el cliente SOAP no hace petición real. `lib/verifactu/client.ts` devuelve respuestas simuladas (`accepted` aleatorio 90%, `rejected` 5%, `error` de red 5%) con CSV ficticio. Permite probar todo el flujo UI sin depender de AEAT. Toda la lógica de firma, hash chain y persistencia se ejecuta igual.
- **`test`**: endpoint de homologación AEAT (`https://prewww1.aeat.es/...`). Requiere certificado FNMT de pruebas o real.
- **`prod`**: endpoint de producción. Solo activar tras validar el flujo completo en `test`.

El feature flag se respeta en el badge del header (`MOCK` / `TEST` / `PROD` en color naranja/azul/verde) para que el equipo siempre sepa contra qué entorno está operando.

#### 7.6.3 Flujo de emision de una factura

1. El equipo hace clic en "Emitir factura" en /invoices/[id].
2. El sistema obtiene la ultima factura emitida para recuperar su current_hash (sera el previous_hash del nuevo registro).
3. Se calcula el current_hash de la nueva factura con computeInvoiceHash().
4. Se insertan en la BD los campos: current_hash, previous_hash, chain_sequence, verifactu_status='pending', issued_by_user_id, issued_from_ip.
5. Los pasos 2-4 se ejecutan dentro de una transaccion con SELECT FOR UPDATE en la fila anterior para evitar race conditions.
6. La factura queda con verifactu_status='pending'. El equipo pulsa "Enviar a AEAT" en la UI (sec. 18.2) cuando esté listo: Server Action construye el XML, lo firma y lo envía vía SOAP.
7. Si la AEAT acepta: UPDATE verifactu_status='accepted', verifactu_csv=<CSV>, INSERT en invoice_events tipo 'verifactu_accepted'.
8. Si la AEAT rechaza: UPDATE verifactu_status='rejected', verifactu_error=<motivo>, INSERT en invoice_events tipo 'verifactu_rejected'. La factura aparece marcada en rojo en el dashboard y en el panel "Avisos" (sec. 11.5) para que el equipo cree una rectificativa.
9. Si hay error de red: UPDATE verifactu_status='error'. La UI muestra botón "Reintentar". El panel "Avisos" lista las facturas en estado 'error' o 'pending' para que no se olviden.

#### 7.6.4 Elementos visuales obligatorios (QR + IDFACT)

La representacion grafica de la factura (PDF y portal cliente) debe incluir DOS elementos obligatorios
segun el art. 9 de la Orden HAC/1177/2024:

**A) Codigo QR tributario**

La URL que codifica el QR tiene el formato definido por la AEAT:
```
https://www2.agenciatributaria.gob.es/wlpl/AVAC-CALC/VerificadorQR?
  nif=<NIF_EMISOR>
  &numserie=<INVOICE_NUMBER>
  &fecha=<DD-MM-YYYY>
  &importe=<TOTAL_2_DECIMALES>
```

Junto al QR debe aparecer el texto obligatorio:
"Factura verificable en la Sede Electronica de la Agencia Tributaria"

El PNG del QR se genera con la libreria `qrcode` y se sube a Supabase Storage
(bucket: invoices-qr, acceso publico) para incluirlo en el PDF y en el portal.

**B) Identificador Unico de Registro de Facturacion (IDFACT)**

Ademas del QR, la representacion grafica debe mostrar el IDFACT como texto legible.
El IDFACT se construye concatenando: `NIF_EMISOR` + `-` + `INVOICE_NUMBER` + `-` + `ISSUED_AT_YYYYMMDD`.
Ejemplo: `B12345678-F-2026-001-20260315`

Este identificador debe aparecer impreso en la factura con el literal:
"Identificador unico de registro de facturacion: <IDFACT>"

La columna `idfact text` se anade a la tabla `invoices` y se calcula una sola vez al emitir.

#### 7.6.5 Facturas rectificativas

La normativa prohibe modificar una factura emitida. Para corregir un error se emite
una factura rectificativa (campo is_rectification=true, serie distinta: R-2026-001).

Tipos segun RD 1619/2012 art.15 y Orden HAC/1177/2024:
- R1: error fundado en derecho (el caso mas habitual: importe incorrecto, datos erroneos)
- R4: simplificada rectificativa (no aplica para facturas B2B con NIF del receptor)
- R5: diferencias (cuando solo se rectifica la diferencia, no la totalidad)

La serie de rectificativas es independiente de la serie de facturas normales.
El sistema debe gestionar una secuencia invoice_seq_rect_{YYYY} separada.

Flujo UI para emitir una rectificativa:
1. En la ficha de la factura emitida: boton "Emitir factura rectificativa".
2. Modal: selector de tipo (R1/R5), campo de texto con el motivo, preview del documento.
3. Al confirmar: se crea una nueva invoice con is_rectification=true, rectified_invoice_id, y se envia a Verifactu como tipo R1/R5.
4. La factura original queda con status='rectified' (no 'cancelled') y enlaza a la rectificativa.

#### 7.6.6 Certificado digital - gestion segura

El certificado (.p12) NUNCA se sube al repositorio de git.
El archivo .gitignore debe incluir *.p12 y *.pfx.

Flujo de configuracion:
1. Exportar el certificado a .p12 desde el navegador o desde la FNMT.
2. Convertir a base64: `base64 -i cert.p12 | tr -d '\n'`
3. Copiar el resultado como valor de VERIFACTU_CERT_P12_BASE64 en Vercel (Environment Variables, entorno Production y Preview por separado).
4. En el codigo, cargar el certificado: `Buffer.from(process.env.VERIFACTU_CERT_P12_BASE64!, 'base64')`

El certificado tiene una validez de 2-4 anios. Registrar la fecha de caducidad en settings
(clave: verifactu_cert_expires_at) y emitir alerta al equipo 30 dias antes.

---

## 8. Sistema de interacciones y seguimiento

### 8.1 UX de la vista de un lead

```
+----------------------------------+------------------------------------------+
|  INFO DEL LEAD                   |  ACTIVIDAD Y SEGUIMIENTO                 |
|                                  |                                          |
|  Nombre: [texto]                 |  [+ Anadir] v                            |
|  Email:  [texto]                 |  [Llamada] [Email] [WhatsApp] [Reunion]  |
|  Telefono: [texto]               |  [Nota interna]                          |
|  Empresa: [texto]                |  ------------------------------------    |
|  Presupuesto: [select]           |  RECORDATORIO ACTIVO                     |
|  Estado: [select con color]      |  "Llamar el lunes 26 mayo"               |
|  Asignado a: [avatar]            |  [Hecho] [Posponer]                      |
|                                  |  ------------------------------------    |
|  RESUMEN IA                      |  TIMELINE (orden cronologico inverso)    |
|  [✨ Resumir con IA]             |                                          |
|  "Interesado en web + ecommerce. |  HOY - Pol                               |
|   Espera propuesta esta semana." |  [Llamada] 12 min - Interesado           |
|                                  |  "Quiere propuesta para el viernes"      |
|  Temperatura: [HOT badge rojo]   |                                          |
|  [Sugerir siguiente paso]        |  AYER - Sistema                          |
|                                  |  [Lead recibido] desde doscientos.es     |
+----------------------------------+------------------------------------------+
```

### 8.2 Quick-add de interaccion (objetivo: menos de 20 segundos)

1. Click en [+ Anadir] abre un dropdown con iconos grandes
2. Al seleccionar tipo se abre un Popover (no pagina nueva) con:
   - Outcome (select): Sin respuesta / Buzon / Interesado / No interesado / Seguimiento
   - Notas (textarea, opcional, placeholder con sugerencia segun tipo)
   - Duracion en minutos (solo llamadas y reuniones)
   - Toggle: Crear recordatorio de seguimiento (si activo: date picker + tipo)
3. Click Guardar: Server Action -> insert en lead_interactions + update leads + insert reminder si aplica
4. El timeline se actualiza via router.refresh() sin recargar la pagina

### 8.3 Email desde el CRM

Modal con:
- Para: (pre-relleno, editable)
- Asunto: (texto libre o selector de plantilla que precarga asunto y cuerpo)
- Cuerpo: (editor simple con soporte de variables {{nombre}}, {{empresa}}, etc.)
- Preview antes de enviar

Al enviar: POST /api/crm/interactions/send-email -> Resend -> graba en lead_interactions con resend_email_id.

### 8.4 Vista global de recordatorios (/reminders)

```
HOY
  [ALTA]  [Llamar]   Empresa X - "Confirmar presupuesto"        [Hecho] [Posponer]
  [MEDIA] [Email]    Lead Y - "Enviar dossier de servicios"      [Hecho] [Posponer]

MANANA
  [BAJA]  [Reunion]  Cliente Z - "Kick-off del proyecto"         [Hecho] [Posponer]

PASADO
  [ALTA]  [Llamar]   Lead W - "Recordatorio vencido hace 2 dias" [Hecho] [Ignorar]
```

## 9. Envío de emails desde el CRM

Permite al equipo enviar emails directamente a leads y clientes sin salir de la plataforma, usando plantillas predefinidas y firmas automáticas.

### 9.1 Configuración de remitente y firma
Cada usuario del equipo configura su identidad en `/settings/profile`:
- **Email Alias**: El email desde el que se envía (ej: `pol@doscientos.es`). Debe pertenecer al dominio verificado en Resend.
- **Firma HTML**: Bloque de texto enriquecido (Tiptap) que se añade automáticamente al final de cada email si la plantilla lo requiere.

### 9.2 Server Action: `sendEmail`
Ubicación: `app/actions/email.ts`.
Flujo:
1. Valida sesión del `team_member` y permisos.
2. Carga datos del remitente (`email_alias`, `signature_html`).
3. Procesa el template usando el `lib/templates/render.ts` (sec. 29) inyectando variables del lead/cliente.
4. Si `include_signature` es true, appendea la firma al cuerpo del email.
5. Envía vía Resend SDK:
   ```typescript
   await resend.emails.send({
     from: `${member.name} <${member.email_alias}>`,
     to: lead.email,
     subject: renderedSubject,
     html: renderedBodyWithSignature,
     reply_to: member.email // Las respuestas llegan al mail personal
   });
   ```
6. Registra la interacción en `lead_interactions` con `resend_email_id`.
7. Inserta evento en `activities` tipo `email_sent`.

### 9.3 Webhook de Resend (`/api/email/webhook`)
Escucha eventos de Resend para actualizar el estado del envío en tiempo real:
- `delivered`: Marca la interacción como entregada.
- `opened`: Primera apertura del email.
- `bounced`: Error de entrega (notifica al autor del email via toast/aviso).
- `clicked`: Clic en algún link del email.

Requiere variable `RESEND_WEBHOOK_SECRET` para validar la firma del webhook.

### 9.4 Interfaz de usuario
Modal "Enviar email" accesible desde la ficha de Lead/Cliente:
- **Selector de plantilla**: Filtra por categoría y precarga asunto/cuerpo.
- **Editor en vivo**: Permite modificar el texto antes de enviar.
- **Preview de variables**: Los tags `{{nombre}}` se ven resaltados.
- **Toggle de firma**: Permite quitar la firma para emails informales.

---


Los recordatorios del usuario aparecen en el panel "Avisos" del dashboard (sec. 11.5) al cargar /inicio. No se envían emails diarios en MVP.

---

## 10. Portal publico de cliente

### 10.1 Rutas publicas

```
/p/proposal/[token]   Vista del presupuesto para el cliente
/p/invoice/[token]    Vista de la factura para el cliente
/p/not-found          Pagina generica si el token no existe (sin info sensible)
```

### 9.2 Comportamiento de la vista de propuesta

- Server Component: carga todos los datos server-side con supabaseAdmin
- Al cargar: incrementa proposals.view_count, actualiza last_viewed_at, registra en activities
- Muestra: logo doscientos, info del cliente, lineas del presupuesto, intro, condiciones, total con IVA
- Botones disponibles:
  - [Aceptar propuesta]: abre modal de confirmacion -> Server Action -> status = 'accepted', notifica al equipo por email
  - [Rechazar]: abre modal con textarea para motivo -> status = 'rejected', notifica al equipo
  - [Descargar PDF]: window.print() con CSS @media print optimizado (sin sidebar ni botones)
- Si status = 'accepted' o 'rejected': muestra estado en lugar de botones (readonly)
- Si status = 'expired': muestra mensaje de propuesta expirada, CTA para contactar

### 9.3 Tracking de apertura (evento 'viewed')

Cada vez que el cliente abre la URL se registra en activities:
```typescript
{
  entity_type: 'proposal',
  entity_id: proposal.id,
  action: 'viewed',
  actor_type: 'client',
  metadata: { ip, user_agent, view_count }
}
```
Esto aparece en el timeline interno del lead/proyecto para que el equipo vea "Cliente vio la propuesta 3 veces".

### 9.4 CSS @media print para PDF

```css
@media print {
  .no-print { display: none !important; }  /* sidebar, botones, topbar */
  body { background: white; color: black; font-size: 11pt; }
  .invoice-content { max-width: 100%; padding: 0; }
  /* Evitar corte de pagina en tablas */
  tr { page-break-inside: avoid; }
}
```

---

## 11. Dashboard Home - KPIs y metricas

La pagina de inicio muestra:

### 11.1 KPI cards (fila superior)

- Leads nuevos este mes (con delta vs mes anterior)
- Propuestas pendientes de respuesta (count)
- Facturacion del mes (EUR, con delta)
- Facturas vencidas sin pagar (count, en rojo si > 0)

### 11.2 Graficos

- Leads por mes (ultimos 6 meses) - bar chart simple con recharts
- Pipeline de leads (donut por status: new, contacted, qualified, lost, converted)
- Ingresos mensuales (linea, ultimos 12 meses)

### 11.3 Actividad reciente

Lista de las ultimas 20 activities del sistema ordenadas por created_at DESC.
Formato: [icono tipo] [texto legible] [tiempo relativo] - "Pol envio propuesta a Empresa X - hace 2 horas"

### 11.4 Recordatorios del dia

Panel lateral derecho con los recordatorios de hoy del usuario logueado.

### 11.5 Panel "Avisos" (sustituye al weekly-digest)

Panel destacado en la parte superior del dashboard que consolida en un solo lugar todo lo
que antes mandaríamos por email semanal. Se calcula en runtime al cargar `/inicio` (Server
Component, query paralela con `Promise.all`). Si no hay nada que avisar, el panel se oculta.

Secciones (cada una se renderiza solo si tiene items):

1. **Recordatorios próximos** — `reminders WHERE assigned_to = me AND status = 'pending' AND due_at <= now() + 7 days`. Marca en rojo los vencidos.
2. **Verifactu pendiente** — facturas con `verifactu_status IN ('pending', 'error', 'rejected')`. CTA "Enviar a AEAT" o "Reintentar" según el caso.
3. **Certificado por caducar** — si `VERIFACTU_CERT_EXPIRES_AT <= now() + 30 days`, banner amarillo con link a settings.
4. **Facturas vencidas** — `invoices_with_status WHERE computed_status = 'overdue'`. CTA "Marcar como pagada" o "Enviar recordatorio al cliente" (acción manual, no automatizada).

```typescript
// app/(dashboard)/page.tsx
export default async function HomePage() {
  const supabase = await createServerClient()
  const user = await getCurrentUser()

  const [reminders, verifactuPending, overdueInvoices] = await Promise.all([
    supabase.from('reminders')
      .select('id, title, due_at, entity_type, entity_id')
      .eq('assigned_to', user.id)
      .eq('status', 'pending')
      .lte('due_at', addDays(new Date(), 7).toISOString()),
    supabase.from('invoices')
      .select('id, invoice_number, verifactu_status, verifactu_error, client:clients(name)')
      .in('verifactu_status', ['pending', 'error', 'rejected']),
    supabase.from('invoices_with_status')
      .select('id, invoice_number, due_date, total, client:clients(name)')
      .eq('computed_status', 'overdue'),
  ])

  const certExpiresAt = process.env.VERIFACTU_CERT_EXPIRES_AT
  const certExpiringSoon = certExpiresAt && new Date(certExpiresAt) <= addDays(new Date(), 30)

  return (
    <>
      <AvisosPanel
        reminders={reminders.data ?? []}
        verifactuPending={verifactuPending.data ?? []}
        overdueInvoices={overdueInvoices.data ?? []}
        certExpiringSoon={certExpiringSoon ? certExpiresAt : null}
      />
      {/* KPI cards, charts, actividad... */}
    </>
  )
}
```

**Ventaja sobre el cron**: la información siempre está al día (no espera al lunes 08:00),
no requiere Vercel Pro, no consume invocaciones, y los CTA permiten resolver el aviso sin
salir del dashboard.

---

## 12. Busqueda global y filtros

### 11.1 Buscador global (topbar)

Shortcut: Cmd+K / Ctrl+K abre el Command component de shadcn.
Busca en tiempo real en: leads (nombre, empresa, email), clientes, proyectos, propuestas, facturas.
Navega directo a la entidad al seleccionar.
Implementar con una API route que consulta multiples tablas en paralelo con Promise.all.

### 11.2 Filtros por seccion

Leads:
- Status (multi-select): new, contacted, qualified, lost, converted
- Asignado a (select)
- Budget (multi-select)
- Source (select)
- Fecha de creacion (rango)
- Temperature IA (hot/warm/cold)

Propuestas:
- Status: draft, sent, accepted, rejected, expired
- Cliente (select con busqueda)
- Rango de importe total
- Fecha de envio (rango)

Facturas:
- Status: draft, sent, paid, overdue, cancelled
- Cliente
- Rango de importe
- Fecha de vencimiento (rango)
- Metodo de pago

### 11.3 Paginacion

Cursor-based pagination en tablas grandes (leads, activities).
Page-based (limit/offset) en tablas pequenas (propuestas, facturas).
Default page size: 25 items. Opciones: 25, 50, 100.

---

## 13. Arquitectura tecnica

### 12.1 Server Components vs Client Components

Regla: por defecto todo es Server Component. Marcar 'use client' solo cuando sea estrictamente necesario.

Server Components (sin 'use client'):
- Todas las paginas del dashboard que solo muestran datos
- El portal publico /p/[tipo]/[token]
- Layout del sidebar y topbar

Client Components (con 'use client'):
- Formularios interactivos (react-hook-form)
- Kanban de leads (drag and drop con @dnd-kit)
- Buscador global con Command
- Popover de quick-add interaccion
- Editor Tiptap (documentos)
- Graficos del dashboard (recharts)
- Toggle de modo claro/oscuro

### 12.2 Server Actions vs API Routes

Server Actions para:
- Crear/editar/cambiar status de cualquier entidad (leads, propuestas, facturas, etc.)
- Registrar interacciones
- Marcar recordatorios como hechos
- Aceptar/rechazar propuesta desde el portal (accion del cliente)

API Routes (/api/*) para:
- Envio de email (necesita logica async compleja con Resend)
- Webhook de Stripe (fase 2)
- Webhook de GitHub (eventos entrantes con validación de firma)
- Generacion de IA (llamadas a OpenAI que pueden tardar)
- Busqueda global (consultas paralelas a multiples tablas)

### 12.3 Manejo de errores

- Server Actions: devuelven { error: string } | { data: T }, nunca hacen throw al cliente
- API Routes: responden con status HTTP correcto y { error: string } en el body
- UI: usar sonner (toast) para mostrar errores y exitos al usuario
- Portal publico: cualquier error redirige a /p/not-found (sin info sensible)
- Logs: pino estructurado a stdout (visible en Vercel Logs / runtime logs del host)

### 12.4 Actualizaciones optimistas

Usar useOptimistic de React 19 en:
- Cambio de status de lead en kanban (drag and drop)
- Marcar reminder como hecho
- Thumbs up/down de propuesta en el portal

### 12.5 Estado global (Zustand)

Store para:
- Estado del sidebar (expandido/colapsado)
- Filtros activos de cada seccion (persisten al navegar entre paginas)
- Usuario logueado (extraido del layout, disponible en todos los Client Components)

---

## 14. Estructura de rutas (Next.js App Router)

```
app/
+-- layout.tsx                    (root layout, fuentes, providers)
+-- (auth)/
|   +-- login/page.tsx            (formulario login, redirige si ya autenticado)
|
+-- (dashboard)/                  (layout protegido via proxy.ts)
|   +-- layout.tsx                (sidebar + topbar + providers)
|   +-- page.tsx                  (home: KPIs, actividad, recordatorios hoy)
|   +-- leads/
|   |   +-- page.tsx              (kanban + vista tabla, filtros)
|   |   +-- [id]/page.tsx         (ficha lead: info + timeline + recordatorios)
|   +-- clients/
|   |   +-- page.tsx              (tabla de clientes con filtros)
|   |   +-- [id]/page.tsx         (perfil cliente: proyectos, propuestas, facturas, docs)
|   +-- projects/
|   |   +-- page.tsx              (tabla de proyectos)
|   |   +-- [id]/page.tsx         (detalle proyecto: milestones, docs, team)
|   +-- proposals/
|   |   +-- page.tsx              (tabla de propuestas con filtros)
|   |   +-- new/page.tsx          (crear propuesta)
|   |   +-- [id]/page.tsx         (editor de propuesta + line items)
|   |   +-- [id]/preview/page.tsx (preview = exactamente lo que ve el cliente)
|   +-- invoices/
|   |   +-- page.tsx              (tabla de facturas con filtros)
|   |   +-- [id]/page.tsx         (detalle + cambio de estado)
|   +-- reminders/
|   |   +-- page.tsx              (lista global agrupada por dia)
|   +-- documents/
|   |   +-- page.tsx              (biblioteca de documentos internos)
|   |   +-- [id]/page.tsx         (editor Tiptap del documento)
|   +-- settings/
|       +-- page.tsx              (datos del emisor, IBAN, templates, catalogo servicios)
|
+-- p/                            (portal publico, sin auth, sin layout dashboard)
|   +-- layout.tsx                (layout minimalista: solo logo + footer)
|   +-- proposal/[token]/page.tsx (vista propuesta para el cliente)
|   +-- invoice/[token]/page.tsx  (vista factura para el cliente)
|   +-- not-found/page.tsx        (pagina generica de token no encontrado)
|
+-- api/
    +-- crm/
    |   +-- interactions/
    |   |   +-- send-email/route.ts   (envio email desde CRM via Resend)
    |   +-- ai/
    |       +-- summarize-lead/route.ts  (resumen IA del lead)
    |       +-- draft-email/route.ts     (borrador email con IA)
    +-- portal/
    |   +-- proposal/accept/route.ts    (Server Action alternativo para el portal)
    +-- github/
        +-- webhook/route.ts                     (recibe eventos de GitHub App)
        +-- create-issue/route.ts                (crea issue en GitHub desde tarea CRM)
```

---

## 15. Componentes clave

### 14.1 Layout

- `<Sidebar>` — nav con iconos, colapsable, badge en Recordatorios
- `<Topbar>` — breadcrumb dinamico, buscador global (Command), campana notificaciones
- `<PageHeader>` — titulo + descripcion + acciones (boton crear, filtros)

### 14.2 Leads

- `<LeadKanban>` — columnas por status con @dnd-kit, cada card muestra avatar, empresa, temperatura IA, dias sin contacto
- `<LeadCard>` — card del kanban, con indicador de temperatura (borde coloreado)
- `<LeadTimeline>` — lista de interactions + activities ordenadas por fecha
- `<InteractionQuickAdd>` — popover con formulario segun tipo de interaccion
- `<ReminderBanner>` — banner del recordatorio activo con botones Hecho/Posponer
- `<AiSummaryCard>` — tarjeta con resumen IA, temperatura, siguiente paso sugerido, boton refresh

### 14.3 Documentos (propuestas y facturas)

- `<LineItemsEditor>` — tabla editable con drag-and-drop, selector de catalogo, totales en tiempo real
- `<ProposalPreview>` — vista readonly de la propuesta (igual que lo ve el cliente)
- `<InvoiceView>` — vista de factura con todos los datos legales, CSS print optimizado
- `<DocumentStatusBadge>` — badge con color segun status de la entidad
- `<SendDocumentModal>` — modal para enviar link por email al cliente con preview del email

### 14.4 Generales

- `<DataTable>` — wrapper de @tanstack/react-table con paginacion, filtros, sorting
- `<EmptyState>` — ilustracion + texto + CTA cuando no hay datos
- `<ConfirmDialog>` — dialog de confirmacion reutilizable para acciones destructivas
- `<ActivityFeed>` — lista de activities con iconos, actor, tiempo relativo
- `<StatsCard>` — card de KPI con valor, label, delta y color segun tendencia

---

## 16. Email templates (via React Email)

Todos los emails se construyen con @react-email/components para garantizar compatibilidad cross-client.
Las plantillas viven en /emails/ en la raiz del proyecto.

Emails del sistema (automaticos):

| Template | Trigger | Destinatario |
|---|---|---|
| new-lead.tsx | Lead nuevo desde landing | Equipo |
| proposal-sent.tsx | Equipo envia propuesta | Cliente |
| proposal-accepted.tsx | Cliente acepta | Equipo |
| proposal-rejected.tsx | Cliente rechaza | Equipo |
| invoice-sent.tsx | Equipo envia factura | Cliente |
| crm-email.tsx | Email manual desde CRM | Lead/Cliente |

Emails diferidos a Phase 2 (requieren cron):
| Template | Trigger | Destinatario |
|---|---|---|
| invoice-overdue.tsx | Recordatorio factura vencida al cliente | Cliente |
| verifactu-alert.tsx | Factura rechazada por AEAT (alerta manual desde la UI) | Equipo |
| recurring-invoice-* | Generación automática de facturas recurrentes | — |

Variables comunes disponibles en todos: nombre_cliente, empresa, url_documento, nombre_agente, fecha.

Estilo de los emails: mismo que la landing (fondo blanco, texto negro, acento negro, fuente Inter, logo doscientos).

---

## 17. Storage (Supabase Storage)

### 16.1 Buckets

| Bucket | Acceso | Uso |
|---|---|---|
| documents | private | Archivos adjuntos a documentos internos |
| avatars | public | Avatares de team_members |

### 16.2 Naming convention

documents/{project_id}/{document_id}/{filename}
avatars/{team_member_id}/avatar.{ext}

### 16.3 Politicas

documents: solo team_members autenticados pueden leer y escribir.
avatars: lectura publica, escritura solo el propio usuario o admin.

---

## 18. Background jobs — sin crons en MVP

**Decisión arquitectural**: el MVP no tiene ningún cron. Toda la lógica que tradicionalmente
viviría en un job se resuelve con dos patrones:

1. **Acciones manuales** desde la UI con feedback inmediato (botones "Enviar a AEAT", "Reintentar").
2. **Cómputo en runtime** al cargar el dashboard (sec. 11.5 "Avisos") y vistas SQL para estados
   derivados (sec. 18.3 `invoices_with_status`).

**Beneficios**:
- Cero coste de infraestructura (compatible con Vercel Hobby).
- Cero fallos silenciosos: si algo no se ha hecho, se ve al instante en el dashboard.
- Cero secretos extra (`CRON_SECRET` no es necesario).
- Cero observabilidad de jobs (no hay `cron_runs`, heartbeats, ni alertas de cron fallido).

**Phase 2** (requiere Vercel Pro o pg_cron de Supabase):
- Notificaciones por email del digest (si el equipo deja de entrar a diario al dashboard).
- Hard-delete GDPR de filas con `deleted_at < now() - 2 years` (sec. 25.3).
- Generación automática de facturas recurrentes cuando aparezca la primera suscripción.

### 17.2 Verifactu: envío manual desde la UI

No hay cron para enviar facturas a la AEAT. El flujo es:

```
[Emitir factura] → verifactu_status = 'pending'
                 → Botón "Enviar a AEAT" en /invoices/[id]
                 → Server Action: firma + SOAP + actualiza status
                 → 'accepted' | 'rejected' | 'error'
                    ↳ 'error': botón "Reintentar"
                    ↳ 'rejected': banner rojo con motivo + CTA "Crear rectificativa"
```

```typescript
// app/_actions/send-to-aeat.ts
'use server'

export async function sendToAeat(invoiceId: string) {
  const supabase = createServiceRoleClient()
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, client:clients(*), issued_by:team_members(*)')
    .eq('id', invoiceId)
    .single()

  const cert = Buffer.from(process.env.VERIFACTU_CERT_P12_BASE64!, 'base64')
  const xml = buildRegistroFacturacion(invoice)
  const signedXml = signXml(xml, cert, process.env.VERIFACTU_CERT_PASSWORD!)

  try {
    const response = await sendToAeatSoap(signedXml, process.env.VERIFACTU_ENV as 'test' | 'prod')

    if (response.code === '0000') {
      await supabase.from('invoices').update({
        verifactu_status: 'accepted',
        verifactu_csv: response.csv,
        verifactu_sent_at: new Date().toISOString(),
        verifactu_response: response.raw,
      }).eq('id', invoiceId)
      await logInvoiceEvent(supabase, invoiceId, 'verifactu_accepted', null, { csv: response.csv })
    } else {
      await supabase.from('invoices').update({
        verifactu_status: 'rejected',
        verifactu_error: response.description,
        verifactu_response: response.raw,
      }).eq('id', invoiceId)
      await logInvoiceEvent(supabase, invoiceId, 'verifactu_rejected', null, response.raw)
    }
  } catch (e: any) {
    const retryCount = (invoice.verifactu_retry_count ?? 0) + 1
    await supabase.from('invoices').update({
      verifactu_status: 'error',
      verifactu_error: e.message,
      verifactu_retry_count: retryCount,
    }).eq('id', invoiceId)
    await logInvoiceEvent(supabase, invoiceId, 'verifactu_error', null, { message: e.message })
  }

  revalidatePath(`/invoices/${invoiceId}`)
}
```

UI en /invoices y /invoices/[id]:
- Badge con `verifactu_status` en la tabla de facturas.
- Botón "Enviar a AEAT" visible si `verifactu_status = 'pending'`.
- Botón "Reintentar" si `verifactu_status = 'error'`.
- Banner rojo si `verifactu_status = 'rejected'` con `verifactu_error` y CTA "Crear rectificativa".
- Icono verde + CSV copiable si `verifactu_status = 'accepted'`.

### 17.3 View `invoices_with_status` (sin cron)

El estado "overdue" se calcula en runtime, eliminando el cron `overdue-invoices`:

```sql
CREATE VIEW invoices_with_status AS
SELECT *,
  CASE
    WHEN status = 'sent' AND due_date < CURRENT_DATE THEN 'overdue'
    ELSE status
  END AS computed_status
FROM invoices;
```

Usar `invoices_with_status` en lugar de `invoices` en todas las queries que necesiten
mostrar el estado real de la factura.

### 17.4 Facturas recurrentes — Phase 2

El cron `generate-recurring-invoices` se implementará cuando aparezca la primera suscripción
activa. La tabla `subscriptions` puede existir vacía sin ningún job asociado.

---

## 19. Gestion de proyectos y tareas

### 18.1 Vistas del tablero de tareas

Cada proyecto tiene su propia sección de tareas en `/projects/[id]/tasks` con tres vistas intercambiables:

#### Vista Kanban

```
+------------------+------------------+------------------+------------------+
|   TODO           |   IN PROGRESS    |   IN REVIEW      |   DONE           |
+------------------+------------------+------------------+------------------+
| [+ Nueva tarea]  |                  |                  |                  |
|                  | #12 Diseño home  | #8 API leads     | #3 Auth          |
| #15 Navbar       |   Pol · Alta     |   Gerard · Alta  |   Gerard         |
|   Sin asignar    |   ● PR #22       |   ⚑ 28 may      |   ✓ hace 2 dias  |
|   ⚑ 1 jun       |                  |                  |                  |
|                  | #14 Tests E2E    |                  | #1 Setup repo    |
| #16 Dark mode    |   Pol · Media    |                  |   Gerard         |
|   Pol · Baja     |   ⚑ 30 may      |                  |                  |
+------------------+------------------+------------------+------------------+
```

- Drag-and-drop entre columnas con @dnd-kit (el mismo que el kanban de leads).
- Al mover a 'done': se registra completed_at, se recalcula completion_percentage del milestone.
- Al mover a 'in_review': si hay PR vinculado, aparece el badge con link al PR.
- Click en la tarjeta: panel lateral (sheet) con todos los detalles, sin navegar a nueva página.

#### Vista Lista

Tabla sortable por: prioridad, fecha límite, asignado, estado. Con filtros rápidos:
- Asignado a mí / Sin asignar / Todos
- Prioridad: Urgente / Alta / Media / Baja
- Hito (milestone)
- Tiene PR / Tiene issue GitHub / Sin vinculo

Subtareas: en la vista lista las subtareas aparecen indentadas bajo la tarea padre.
Toggle para expandir/colapsar.

#### Vista Gantt — Phase 2 (diferida)

El Gantt visual tiene ROI bajo en proyectos de agencia cortos (1-3 meses) y añade complejidad
de rendering significativa. Se difiere hasta validar que el equipo lo necesita activamente.

**MVP**: la vista Kanban + Lista cubre el 95% de los casos de uso. El campo `milestone.start_date`
y `milestone.color` están en el schema y son suficientes para mostrar los hitos en la vista Lista.

**Phase 2**: si el equipo pide Gantt, implementar con `@dnd-kit` + CSS Grid + `date-fns`.
Solo lectura en Phase 2; edición drag-and-drop en Phase 3 si procede.

### 18.2 Panel lateral de tarea (TaskSheet)

Al hacer click en cualquier tarea se abre un `<Sheet>` de shadcn desde la derecha con:

```
┌─────────────────────────────────────────────────────┐
│  [← Volver]   #15 Navbar responsive        [···]   │
├─────────────────────────────────────────────────────┤
│  Estado:   [In Progress ▼]  Prioridad: [Alta ▼]    │
│  Asignado: [Pol ▼]          Milestone:  [Sprint 1]  │
│  Inicio:   [25 may]         Límite:     [28 may]    │
│  Estimado: [4h]             Tags:       [design]    │
├─────────────────────────────────────────────────────┤
│  Descripción                                        │
│  [Textarea Markdown + preview toggle + @menciones]  │
│  (react-markdown para preview; sin Tiptap en MVP)   │
│                                                     │
├─────────────────────────────────────────────────────┤
│  GitHub                                             │
│  Issue: #42 "Add responsive navbar"  [Abrir ↗]     │
│  PR:    #61 "feat: responsive navbar" [Abrir ↗]     │
├─────────────────────────────────────────────────────┤
│  Subtareas  [+ Añadir]                              │
│  ☑ Diseño mobile                                   │
│  ☐ Breakpoints tablet                              │
│  ☐ Tests visuales                                  │
├─────────────────────────────────────────────────────┤
│  Comentarios                                        │
│  [Pol] hace 1h                                      │
│  "He vinculado el PR. @Gerard revisa el CSS"        │
│                                                     │
│  [Escribe un comentario... @menciones soportadas]   │
│                                              [Send] │
└─────────────────────────────────────────────────────┘
```

### 18.3 Quick-add de tarea

Desde cualquier columna del kanban: clic en `[+ Nueva tarea]` abre un inline input.
Solo requiere título; el resto de campos se completan después en el panel lateral.
Al guardar: INSERT en tasks con status = columna actual, project_id = proyecto activo, kanban_order = max + 1000.

### 18.4 Menciones (@) y notificaciones

Cuando un comentario contiene `@nombre`:
1. El frontend parsea las menciones y rellena el array `mentions[]` con los UUIDs.
2. Al INSERT de `task_comments`: trigger DB llama a `pg_notify('mention', payload)`.
3. El servidor escucha via Supabase Realtime y envía email con template `task-mention.tsx` si el mencionado no ha tenido actividad en los últimos 5 minutos (evitar spam en conversaciones activas).
4. Badge de notificaciones en la sidebar muestra el conteo de menciones no leídas.

### 18.5 Progress automático de milestones

Trigger DB en `tasks` que recalcula `milestones.completion_percentage` en cada UPDATE de status:

```sql
CREATE OR REPLACE FUNCTION update_milestone_progress()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  total_tasks int;
  done_tasks  int;
BEGIN
  IF NEW.milestone_id IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'done')
  INTO total_tasks, done_tasks
  FROM tasks
  WHERE milestone_id = NEW.milestone_id AND status != 'cancelled';

  UPDATE milestones
  SET completion_percentage = CASE WHEN total_tasks = 0 THEN 0
                                   ELSE ROUND((done_tasks::numeric / total_tasks) * 100)
                              END,
      -- Si llega al 100% y es un payment_milestone: marcar como 'completed'
      status = CASE WHEN total_tasks > 0 AND done_tasks = total_tasks THEN 'completed'
                    ELSE status
               END,
      completed_at = CASE WHEN total_tasks > 0 AND done_tasks = total_tasks THEN now()
                          ELSE completed_at
                     END
  WHERE id = NEW.milestone_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_milestone_progress
  AFTER INSERT OR UPDATE OF status ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_milestone_progress();
```

Cuando un `is_payment_milestone=true` pasa a `completed`: se registra en activities y
aparece un banner en la ficha del proyecto sugiriendo generar la factura del hito.

---

## 20. Integracion GitHub bidireccional

### 19.1 Modelo de integracion

El CRM se vincula a uno o varios repositorios GitHub de la organización a través de una
**GitHub App** instalada en la organización. Cada proyecto en el CRM puede estar asociado
a un repositorio concreto.

```sql
-- Columnas nuevas en projects:
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS github_repo_owner text,         -- ej: 'doscientos-dev'
  ADD COLUMN IF NOT EXISTS github_repo_name  text,         -- ej: 'cliente-web'
  ADD COLUMN IF NOT EXISTS github_repo_url   text;         -- URL completa al repo
```

Variable de entorno necesaria (GitHub App):
```env
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY_BASE64=    # clave privada de la GitHub App en base64
GITHUB_WEBHOOK_SECRET=            # secret para validar los webhooks entrantes
```

### 19.2 Sincronizacion CRM → GitHub

**Crear issue desde tarea:**
Cuando el equipo hace clic en "Crear issue en GitHub" desde el panel de tarea:
1. `POST /api/github/create-issue` con `task_id`.
2. La API route crea el issue en el repo vinculado al proyecto via GitHub REST API.
3. Se guarda `github_issue_number` y `github_issue_url` en la tarea.
4. El issue se crea con: título = task.title, body = task.description, labels = task.tags,
   assignees = handle de GitHub del team_member (configurado en team_members.github_handle).
5. Se registra en activities: "Issue #N creado en GitHub".

**Crear milestone en GitHub:**
Cuando se crea un milestone en el CRM con `github_milestone_number IS NULL`:
- Botón "Sincronizar con GitHub" en la UI del milestone.
- Crea el milestone en GitHub con la misma fecha límite.
- Guarda el `github_milestone_number` en la tabla.

### 19.3 Sincronizacion GitHub → CRM (webhooks)

Endpoint: `POST /api/github/webhook` — valida el header `X-Hub-Signature-256` con
`GITHUB_WEBHOOK_SECRET` antes de procesar.

Eventos que procesa:

| Evento GitHub | Acción en el CRM |
|---|---|
| `issues.opened` | Si la URL del issue contiene el prefijo del CRM (creado desde CRM), no hace nada. Si es un issue nuevo creado directo en GitHub, crea tarea en el proyecto vinculado con `status='todo'`, `source='github'`. |
| `issues.closed` | UPDATE task.status = 'done', task.completed_at = now() |
| `issues.reopened` | UPDATE task.status = 'todo', task.completed_at = null |
| `issues.assigned` | UPDATE task.assignee_id según github_handle del team_member |
| `issues.labeled` | Sincroniza task.tags con los labels del issue |
| `issue_comment.created` | INSERT task_comment con source='github', github_comment_id, body del comentario, author mapeado por github_handle |
| `pull_request.opened` | UPDATE task.github_pr_number, github_pr_url. El parser de `Closes #N` en el body del PR es frágil y se omite en MVP: el equipo vincula la tarea manualmente desde el TaskSheet si el PR no viene de CRM. |
| `pull_request.closed` + merged=true | UPDATE task.status='done' (si no lo estaba ya) |
| `pull_request.closed` + merged=false | UPDATE task.status='todo' (PR rechazado) |
| `milestone.created` | Si no existe en CRM: crear milestone en el proyecto vinculado |
| `milestone.closed` | UPDATE milestone.status='completed' |

### 19.4 Mapeo de usuarios GitHub ↔ team_members

Añadir campo `github_handle` a team_members:
```sql
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS github_handle text UNIQUE;
```

Cada miembro del equipo configura su handle de GitHub en `/settings/profile`.
El webhook usa este mapeo para asignar tareas y comentarios al miembro correcto.
Si un handle de GitHub no tiene correspondencia en team_members, los eventos se ignoran
(no se crean usuarios fantasma).

### 19.5 Vista "GitHub" en el panel de tarea

En el TaskSheet (panel lateral de tarea):
- Si `github_issue_url IS NOT NULL`: botón "Ver issue #N" que abre en nueva pestaña.
  Badge de estado del issue (open/closed) obtenido via GitHub API con cache de 5 min (SWR).
- Si `github_pr_url IS NOT NULL`: badge "PR #N" con estado (open/merged/closed) y link.
- Si no hay issue vinculado: botón "Crear issue en GitHub" (llama al endpoint 19.2).
- Sección "Commits" (opcional fase 2): lista de commits que referencian la tarea con `#task-uuid`.

---

## 21. Integracion con la landing (doscientos.es)

Cambio minimo en src/actions/index.ts de la landing:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // la landing necesita la service_role key
)

// Anadir dentro del handler de sendContact, tras el envio de email:
await supabaseAdmin.from('leads').insert({
  name, email, phone, company, budget, message,
  source: 'landing', status: 'new',
  utm_source, utm_medium, utm_campaign,
  referrer, ip, device, browser, language
})
// Notion y Google Sheets: deprecar gradualmente tras validar que Supabase funciona
```

El CRM usa Supabase Realtime para mostrar notificacion instantanea cuando llega un lead:
```typescript
supabase.channel('leads').on('postgres_changes',
  { event: 'INSERT', schema: 'public', table: 'leads' },
  (payload) => showToast('Nuevo lead: ' + payload.new.name)
).subscribe()
```

---

## 22. Automatizaciones

La tabla `activities` es el **audit log central** de la aplicación. Toda mutación significativa
(lead creado/convertido, propuesta enviada/aceptada, factura emitida/pagada, tarea completada,
issue GitHub sincronizado) debe insertar una fila en `activities`. Esto permite:
- Historial completo auditable en la ficha de cada entidad.
- Dashboard de actividad del equipo.
- Detectar anomalías (ej: muchas facturas emitidas en poco tiempo → posible bug).

**Idempotency en mutaciones críticas de facturación:**
Los endpoints `POST /api/crm/invoices` y `RPC create_recurring_invoice` aceptan el header
`Idempotency-Key: <uuid>`. Si ya existe una factura con esa key (campo `idempotency_key` en
`invoices`), la API devuelve la factura existente con HTTP 200 sin crear duplicado.
Crítico para evitar doble facturación si Vercel reintenta la request o el cron se ejecuta dos veces.

| Trigger | Accion automatica |
|---|---|
| Lead nuevo desde landing | Supabase Realtime notifica al CRM + email al equipo |
| Interaccion registrada | Trigger DB: actualiza last_interaction_at, incrementa interactions_count |
| Reminder creado | Trigger DB: actualiza next_followup_at del lead |
| Carga de /inicio | Panel "Avisos" (sec. 11.5) lista recordatorios proximos, Verifactu pendiente, facturas vencidas y aviso de certificado |
| Reminder vencido sin resolver | Aparece resaltado en rojo en /reminders y en el panel "Avisos" |
| Email enviado desde CRM | Registra en lead_interactions con resend_email_id |
| Propuesta enviada | Email al cliente con el link. Registra en activities. |
| Cliente abre propuesta | Incrementa view_count, registra 'viewed' en activities |
| Cliente acepta propuesta | Email al equipo. Proyecto pasa a 'active'. Registra en activities. |
| Cliente rechaza propuesta | Email al equipo con motivo. Registra en activities. |
| Factura creada desde propuesta | Pre-rellena line items, cliente, totales. Asigna invoice_number. |
| Factura enviada | Email al cliente con link. Registra en activities. |
| Factura vencida (view `invoices_with_status`) | computed_status='overdue' en runtime. Aparece en el panel "Avisos" con CTA "Marcar pagada" o "Enviar recordatorio". |
| Subscription (Phase 2) | Generacion automatica de facturas recurrentes diferida hasta que exista la primera suscripcion. |
| Factura emitida (sale de draft) | Calcula current_hash, inserta chain_sequence, verifactu_status='pending'. INSERT invoice_events 'issued'. |
| Pulsar "Enviar a AEAT" | Server Action sec. 18.2: firma XML, envia SOAP, UPDATE a 'accepted'/'rejected'/'error'. INSERT invoice_events. |
| Factura rechazada por AEAT | Badge rojo en /invoices y entrada en panel "Avisos". El equipo crea rectificativa manualmente. |
| Emision de factura rectificativa | Crea invoice con is_rectification=true. UPDATE factura original a status='rectified'. Botones "Enviar a AEAT" para ambas. |
| Certificado a 30 dias de caducar | Banner amarillo en panel "Avisos" con link a settings (calculado al cargar /inicio comparando VERIFACTU_CERT_EXPIRES_AT con hoy). |
| Tarea movida a 'done' | Trigger: recalcula milestone.completion_percentage. Si llega al 100% y is_payment_milestone: banner en proyecto. |
| Comentario con @mencion | Trigger DB -> pg_notify -> email task-mention.tsx al mencionado (si inactivo >5 min). |
| GitHub issue cerrado (webhook) | UPDATE task.status = 'done', completed_at = now(). Registra en activities. |
| PR merged (webhook GitHub) | UPDATE task.status = 'done'. Si tarea no tenia PR vinculado: vincula PR. Registra en activities. |
| PR abierto con 'Closes #N' (webhook GitHub) | UPDATE task.status = 'in_review', github_pr_number, github_pr_url. |
| Issue nuevo en GitHub (no creado desde CRM) | INSERT tarea en proyecto vinculado con source='github', status='todo'. |
| Milestone 100% completo con is_payment_milestone | Banner en /projects/[id] sugiriendo generar factura del hito. Registra en activities. |
| Timer de tiempo iniciado | INSERT time_entry con ended_at=null. Valida que no haya otro timer abierto para el mismo miembro. |
| Timer detenido | UPDATE time_entry.ended_at=now(). duration_minutes calculado por columna GENERATED. |
| Botón "Importar horas no facturadas" | Lee time_entries WHERE invoiced_at IS NULL, genera line_items, UPDATE invoiced_at+invoice_id. Registra en activities. |
| Notificación enviada (email/in_app) | Solo si notification_preferences.enabled=true para ese member+event_type+channel. |

---

## 23. IA - Asistente de leads

### 22.1 Resumen de lead (POST /api/crm/ai/summarize-lead)

Input que se envia al modelo:
```
Eres un asistente de CRM para una agencia de desarrollo web.
Analiza la siguiente informacion sobre un lead y devuelve un JSON.

Lead: {nombre}, empresa: {empresa}, presupuesto: {budget}
Mensaje original: {message}
Interacciones (cronologico):
  - {fecha} | {tipo} | {outcome} | "{notas}"
  ...

Responde SOLO con este JSON sin markdown:
{
  "summary": "resumen en 2-3 frases",
  "suggested_next_step": "accion concreta recomendada",
  "temperature": "hot|warm|cold",
  "confidence": 0.0-1.0
}
```

Modelo: gpt-4o-mini (coste bajo, suficiente para texto corto).
Resultado guardado en leads.ai_summary, ai_suggested_next_step, ai_temperature, ai_confidence, ai_updated_at.

### 22.2 Borrador de email (POST /api/crm/ai/draft-email)

Input: lead info + ultimas 5 interacciones + tipo de email deseado.
Output: { subject: string, body: string }
Modelo: gpt-4o.
El equipo SIEMPRE revisa y edita antes de enviar. Nunca envio automatico.

### 22.3 Configuracion

Todas las llamadas a OpenAI desde API Routes de Next.js, nunca desde el cliente.
Timeout: 30 segundos. Si falla: devolver error al usuario, no bloquear el flujo.

---

## 24. Variables de entorno

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=hola@doscientos.es
RESEND_WEBHOOK_SECRET=            # Secret para validar webhooks de Resend (delivered, opened, bounced)

# OpenAI
OPENAI_API_KEY=

# Verifactu / SIF (RD 1007/2023)
# Certificado digital de representante de persona juridica (.p12 en base64)
# Obtener de FNMT (https://www.fnmt.es) o Camerfirma
# Convertir: base64 -i cert.p12 | tr -d '\n'
VERIFACTU_CERT_P12_BASE64=
# Contrasena del certificado .p12
VERIFACTU_CERT_PASSWORD=
# 'test' = endpoint de homologacion AEAT | 'prod' = produccion AEAT
# Empezar siempre en 'test'. Cambiar a 'prod' tras validar con Hacienda.
VERIFACTU_ENV=test
# NIF del emisor (debe coincidir con el certificado digital)
VERIFACTU_NIF_EMISOR=

# GitHub App (integracion bidireccional tareas <-> issues)
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY_BASE64=    # clave privada de la GitHub App en base64
GITHUB_WEBHOOK_SECRET=            # secret para validar firma de webhooks entrantes

# App URLs
NEXT_PUBLIC_APP_URL=https://app.doscientos.es
NEXT_PUBLIC_LANDING_URL=https://doscientos.es
```

---

## 25. Observabilidad

Enfoque lean para MVP: sin SaaS externos de pago. Toda la observabilidad se apoya en
los logs nativos del host (Vercel Logs o equivalente) y en la tabla `activities` para el
audit funcional. Sentry, Axiom, BetterStack y similares quedan diferidos a Phase 2 y solo
se evaluarán si el volumen de errores reales lo justifica.

### 24.1 Logs estructurados — Pino a stdout

```typescript
// lib/logger.ts
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  // Sin transport: escribe JSON a stdout, el host lo recoge automáticamente
  base: { app: 'crm-doscientos' },
  timestamp: pino.stdTimeFunctions.isoTime,
})

// Uso en API routes:
logger.info({ action: 'invoice.issued', invoiceId, userId }, 'Factura emitida')
logger.error({ action: 'verifactu.send', error: err.message }, 'Error AEAT')
```

Los logs JSON son consultables desde el dashboard del host (Vercel Logs, Coolify logs, etc.).
Para errores no capturados en API routes se usa el bloque `try/catch` y `logger.error()` —
sin reporting externo en MVP.

### 24.2 Audit funcional — tabla activities

La tabla `activities` (sec. 5.11) es el log de eventos de negocio. Toda mutación
significativa inserta una fila. Para auditoría legal (Verifactu) la tabla `invoice_events`
(sec. 5.17) es append-only via RLS.

### 24.3 Monitoreo

MVP no tiene crons, así que tampoco hay monitorización específica de jobs. Lo único
que se loguea con `pino` son las Server Actions críticas:

- `verifactu.send.start` / `verifactu.send.end` / `verifactu.send.error` (sec. 18.2)
- `email.sent` / `email.error` (envíos vía Resend)
- `auth.login` / `auth.logout` / `auth.failure`

Supabase hace backups diarios automáticos; no se necesita verificación adicional en MVP.

---

## 26. GDPR y soft delete

### 25.1 Principios

- `leads`, `clients`, `team_members` y `tasks` tienen `deleted_at timestamptz`.
- Todas las queries de aplicación añaden `WHERE deleted_at IS NULL` (via helper `activeQuery()`).
- Las facturas y `invoice_events` **nunca** se borran (obligación fiscal 6 años, RD 1619/2012 art.19).
- Los time_entries de facturas emitidas tampoco se borran (trazabilidad).

### 25.2 Endpoints GDPR

```
POST /api/gdpr/leads/[id]/erase
  → Anonimiza: name, email, phone, ip, message, company → valores neutros
  → Mantiene: status, source, created_at (datos estadísticos sin PII)
  → Solo accessible por role='owner' o role='admin'

POST /api/gdpr/clients/[id]/erase
  → Requiere que no haya facturas pendientes de pago
  → Anonimiza PII del cliente
  → Facturas quedan con datos anonimizados pero invoice_number intacto (legal)

GET /api/gdpr/clients/[id]/export
  → ZIP con: datos del cliente en JSON + PDFs de todas sus facturas
  → Solo accessible por role='owner' o role='admin'
```

### 25.3 Retention policy

El borrado físico de filas con `deleted_at < now() - interval '2 years'` se implementará
en Phase 2 con un pg_cron de Supabase cuando haya datos reales con esa antigüedad.

---

## 27. Rate limiting

Implementación en memoria con `lru-cache` (sin dependencias externas). Suficiente para
un equipo de 2 personas y volumen bajo del portal cliente. El estado vive por instancia
serverless; tras ataques reales o tráfico significativo, migrar a Redis (Upstash o
self-hosted) en Phase 2.

```typescript
// lib/ratelimit.ts
import { LRUCache } from 'lru-cache'

type Bucket = { count: number; resetAt: number }
const buckets = new LRUCache<string, Bucket>({ max: 5000, ttl: 60_000 })

export function rateLimit(key: string, limit: number, windowMs = 60_000) {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: limit - 1 }
  }
  if (b.count >= limit) return { success: false, remaining: 0 }
  b.count++
  return { success: true, remaining: limit - b.count }
}

// En proxy.ts:
const identifier = user?.id ?? ip
const { success } = rateLimit(identifier, 100)
if (!success) return new Response('Too Many Requests', { status: 429 })
```

Límites específicos por ruta:
| Ruta | Límite |
|---|---|
| `/api/crm/*` | 100 req/min por usuario |
| `/api/portal/*` | 30 req/min por IP |
| `/api/github/webhook` | Sin límite (fuente de confianza, valida por firma) |
| `/api/gdpr/*` | 5 req/min por usuario (operaciones pesadas) |

---

## 28. Calendar ICS

Endpoint que expone tareas con `due_date` y recordatorios como feed de calendario estándar.
Suscribible desde Google Calendar, Apple Calendar, Outlook.

```
GET /api/calendar/[memberId]/feed.ics?token=[calendar_token]
```

- `calendar_token`: campo adicional en `team_members`, UUID random, diferente al session token.
  Permite suscribirse sin exponer credenciales de sesión.
- Incluye: tareas asignadas al miembro con `due_date IS NOT NULL` + reminders del miembro.
- Formato: iCal RFC 5545. Librería: `ical-generator` (npm).
- Actualización: sin cache en Vercel (header `Cache-Control: no-store`), el cliente de calendario
  hace polling cada 15-60 min por su cuenta.

---

## 29. Template renderer

Renderer unificado para todas las plantillas con variables (propuestas, facturas, emails):

```typescript
// lib/templates/render.ts
export type TemplateContext = {
  client: Pick<Client, 'name' | 'company' | 'email'>
  project?: Pick<Project, 'name'>
  proposal?: Pick<Proposal, 'public_token' | 'total'>
  invoice?: Pick<Invoice, 'invoice_number' | 'total' | 'due_date'>
  member?: Pick<TeamMember, 'name'>
}

const VARIABLES: Record<string, (ctx: TemplateContext) => string> = {
  '{{client.name}}':       ctx => ctx.client.name,
  '{{client.company}}':   ctx => ctx.client.company,
  '{{client.email}}':     ctx => ctx.client.email,
  '{{project.name}}':     ctx => ctx.project?.name ?? '',
  '{{proposal.link}}':    ctx => `${APP_URL}/p/proposal/${ctx.proposal?.public_token}`,
  '{{invoice.number}}':   ctx => ctx.invoice?.invoice_number ?? '',
  '{{invoice.total}}':    ctx => formatCurrency(ctx.invoice?.total ?? 0),
  '{{invoice.due_date}}': ctx => formatDate(ctx.invoice?.due_date),
  '{{member.name}}':      ctx => ctx.member?.name ?? '',
}

export function renderTemplate(template: string, ctx: TemplateContext): string {
  return Object.entries(VARIABLES).reduce(
    (text, [key, fn]) => text.replaceAll(key, fn(ctx)),
    template
  )
}
```

Usado en: `email_templates.body`, `proposals.body_md`, subject de emails transaccionales.
Las variables disponibles se muestran en el editor de `email_templates` como chips clicables.

---

## 30. Patrones de UX (foundations)

Patrones obligatorios en toda la app para una UX consistente y profesional. Estos patrones
forman parte del Step 1 del roadmap — no son polish opcional.

### 29.1 Loading states (streaming + Suspense)

Aprovechar el App Router de Next.js 16:

- `loading.tsx` en cada segmento de ruta con un `<Skeleton>` que respete el layout final.
- `<Suspense fallback={<TableSkeleton />}>` envolviendo cualquier query con latencia (queries
  de Supabase con joins, llamadas a OpenAI, queries del dashboard).
- Skeletons específicos por componente: `<KanbanSkeleton>`, `<TableSkeleton>`,
  `<InvoiceSkeleton>`, `<AvisosSkeleton>`. Nunca un spinner genérico.
- **Streaming**: las KPI cards del dashboard se renderizan independientemente (cada una en
  su propio `<Suspense>`), no esperan a las más lentas.

### 29.2 Empty states

Tres variantes obligatorias para cada tabla/lista:

| Variante | Cuándo | Contenido |
|---|---|---|
| **First-time** | El usuario no ha creado nada todavía | Ilustración + texto motivador + CTA primaria ("Crea tu primer lead") |
| **No results** | Filtros aplicados sin matches | Texto neutro + botón "Limpiar filtros" |
| **Error** | Query falló | Mensaje claro + botón "Reintentar" |

Componente único `<EmptyState variant="first-time | no-results | error" />` con props
para icono, título, descripción y CTA.

### 29.3 Error boundaries

- `error.tsx` en cada segmento de ruta con `<ErrorBoundary>` que muestra el error de forma
  amigable y un botón "Reintentar" (`reset()`).
- `global-error.tsx` en `app/` para errores que escapan a los boundaries de segmento.
- Errores de Server Action: se devuelven como `{ error: string }` y se muestran via `toast.error()`.
- Errores de portal público: redirect a `/p/not-found` (sec. 10), nunca exponer el stack.

### 29.4 Optimistic UI (`useOptimistic`)

Aplicar `useOptimistic` de React 19 en toda acción cuya latencia perceptible afecte al flujo:

| Acción | Update optimista |
|---|---|
| Drag-and-drop de lead en kanban | Cambio inmediato de columna |
| Marcar reminder como hecho | Tachado inmediato |
| Aceptar/rechazar propuesta en portal | UI cambia antes de la confirmación |
| Toggle de "pagada" en factura | Badge cambia al instante |
| Reordenar line_items | Posición actualizada en UI sin esperar al servidor |
| Marcar task como done | Movida de columna kanban inmediatamente |

Si el Server Action falla, se revierte automáticamente y `toast.error()` con motivo.

### 29.5 Autosave (borradores)

Documentos largos (propuestas, descripciones de leads, notas de proyecto) usan autosave:

- Debounce de **2 segundos** tras el último cambio.
- Indicador en topbar del editor: `Guardando…` → `Guardado a las 14:32` (verde, fade out a 5s).
- Sin botón "Guardar" explícito; el botón principal es "Enviar al cliente" / "Emitir".
- Si el guardado falla: badge rojo `Sin conexión – reintentando` y cola de cambios en localStorage.
- Hook `useAutosave({ data, onSave, debounceMs: 2000 })` reutilizable.

### 29.6 Undo en acciones destructivas

Toda mutación destructiva NO usa modal de confirmación bloqueante. En su lugar:

```typescript
// Patrón: soft-delete optimista + toast con undo (5s)
async function deleteLead(id: string) {
  const lead = await softDelete('leads', id) // UPDATE deleted_at = now()
  toast('Lead eliminado', {
    action: { label: 'Deshacer', onClick: () => restore('leads', id) },
    duration: 5000,
  })
}
```

Aplicar a: eliminar lead, eliminar cliente, eliminar proyecto, eliminar task,
eliminar documento, eliminar reminder, eliminar line_item.

`<ConfirmDialog>` solo para acciones IRREVERSIBLES: emitir factura (sale de draft),
enviar factura a AEAT, crear rectificativa, borrado físico GDPR.

### 29.7 Atajos de teclado

Documentados en un panel `?` (modal con todos los atajos) accesible desde Topbar:

| Atajo | Acción |
|---|---|
| `Cmd/Ctrl + K` | Command palette (búsqueda + acciones) |
| `Cmd/Ctrl + /` | Mostrar lista de atajos |
| `g` luego `l` | Ir a Leads |
| `g` luego `c` | Ir a Clientes |
| `g` luego `p` | Ir a Proyectos |
| `g` luego `f` | Ir a Facturas |
| `g` luego `r` | Ir a Recordatorios |
| `g` luego `h` | Ir a Inicio |
| `n` | Nueva entidad en el contexto actual (nuevo lead en /leads, nueva factura en /invoices...) |
| `e` | Editar entidad actual |
| `/` | Focus en buscador global |
| `Esc` | Cerrar modal/sheet/popover |
| `Enter` en filas de tabla | Abrir entidad |
| `j` / `k` | Navegar arriba/abajo en listas y tablas |

Implementar con `react-hotkeys-hook` o el handler nativo en un provider raíz.

### 29.8 Command palette (Cmd+K)

No solo busca entidades; también ejecuta **acciones**:

```
> Crear nuevo lead
> Crear nueva factura para [cliente]
> Ir a /settings
> Cambiar a modo claro
> Activar 2FA
> Exportar leads a CSV
> [resultados de búsqueda en entidades...]
```

Estructura: `commands.ts` con array tipado `{ id, label, icon, shortcut?, action: () => void, keywords: string[] }`.
shadcn `<Command>` ya soporta secciones (`<CommandGroup>`) y filtrado fuzzy.

### 29.9 Bulk actions en tablas

`<DataTable>` incluye selección de filas (checkbox en la primera columna):

- Selecciona una fila → aparece toolbar contextual encima de la tabla: "1 seleccionada".
- Acciones por entidad:
  - **Leads**: cambiar status, asignar a, exportar CSV, eliminar.
  - **Facturas**: marcar pagadas, descargar PDF en bulk (.zip), exportar CSV.
  - **Tasks**: cambiar status, asignar a, eliminar.
  - **Clientes**: exportar CSV, eliminar.
- Shift+click para seleccionar rango. `Cmd/Ctrl+A` para seleccionar todo (todas las páginas).

### 29.10 Saved views (filtros guardados)

Por usuario, cada tabla con filtros tiene "Vistas guardadas":

- Tabla `saved_views (id, member_id, entity, name, filters jsonb, is_shared bool, created_at)`.
- Dropdown junto a los filtros: "Mis vistas" + "Vistas compartidas del equipo".
- Botón "Guardar vista actual" cuando hay filtros activos.
- Vistas built-in no eliminables: "Todos", "Activos", "Asignados a mí", "Recientes".

### 29.11 Concurrencia (optimistic locking)

Para evitar que dos miembros pisen ediciones (típico en propuestas y facturas en draft):

- Cada tabla editable lleva `updated_at timestamptz NOT NULL DEFAULT now()`.
- El form lee `updated_at` al cargar y lo envía como `If-Unmodified-Since` en el UPDATE.
- Server Action compara: si cambió, devuelve `{ error: 'CONFLICT', currentData }`.
- UI: dialog "Otro miembro modificó este documento. ¿Quieres recargar o sobreescribir?"

### 29.12 Sesión y reauth

- Middleware en `proxy.ts` refresca el token de Supabase silenciosamente.
- Si la sesión expira durante una acción: toast "Sesión expirada" + redirect a `/login?next=...`.
- 2 minutos antes del expiry: toast preventivo "Tu sesión caducará pronto. [Mantener activa]".

### 29.13 Subida de archivos

Componente `<FileDropzone>` para documents y avatars:

- Drag-and-drop sobre el área + click para abrir picker.
- Preview inmediato (imágenes) o icono por tipo MIME.
- Barra de progreso por archivo, cancelable.
- Reintento automático en fallo de red (3 intentos exponenciales).
- Validación cliente antes de subir: tamaño máx (10 MB documents, 2 MB avatars), MIME types permitidos.

### 29.14 Accesibilidad (a11y)

- **Focus ring visible** en todo elemento interactivo (Tailwind `focus-visible:ring-2`).
- **ARIA**: `aria-label` en iconos sin texto, `aria-live="polite"` en toasts, `role="status"` en indicadores de carga.
- **Contraste WCAG AA mínimo**: tokens del design system ya cumplen (verificar en §3.2).
- **Reduced motion**: respetar `prefers-reduced-motion` — desactivar animaciones de drag, fade, slide.
- **Tab order lógico**: form fields en orden visual, skip-link "Saltar al contenido" como primer focus.
- **Tablas accesibles**: `<caption>`, `scope="col"`, navegación con flechas.
- Test automático con `@axe-core/playwright` en E2E.

### 29.15 Prefetch y navegación rápida

- `<Link prefetch={true}>` en sidebar (rutas fijas, prefetch al montar).
- `<Link prefetch="onHover">` en filas de tabla (prefetch al hacer hover, no al renderizar).
- `router.prefetch()` programático cuando se acerca el final del scroll (paginación infinita).

### 29.16 Recent items

Sidebar incluye sección "Reciente" con las 5 últimas entidades vistas (mix de leads, clientes,
proyectos, propuestas, facturas). Persistido en `localStorage` por usuario.

### 29.17 Formateo consistente

`lib/format.ts` centraliza:

- `formatCurrency(amount: number, currency = 'EUR')` → `1.234,56 €` (Intl.NumberFormat es-ES).
- `formatDate(date, style: 'short' | 'long' | 'relative')` → date-fns con locale `es`.
- `formatNumber(n: number, decimals = 2)` → `1.234,56`.
- `formatNif(nif: string)` → con validación de letra de control.
- `formatIban(iban: string)` → bloques de 4 con espacios.
- `formatPhone(phone: string)` → formato internacional E.164.

Reglas obligatorias:
- Importes en facturas/propuestas: 2 decimales SIEMPRE.
- Importes en KPIs: redondeo a entero si > 1.000 €, 2 decimales si menor.
- Fechas en tablas: formato corto (`23 may 2026`). En tooltip: largo con hora.
- Fechas en timeline: relativo (`hace 2 horas`).

### 29.18 Polish visual y consistencia

- **Tabular numbers** en todas las tablas con cifras (`font-variant-numeric: tabular-nums`).
- **Color coding** de status consistente en toda la app: define una tabla en §3 design system y reutiliza el componente `<StatusBadge entity="invoice" status={status} />`.
- **Sticky headers** en tablas largas (`position: sticky; top: 0`).
- **Sticky toolbar** en editores de propuesta/factura (toolbar siempre visible al hacer scroll).
- **Smooth scroll** al cambiar de ancla.
- **Page transitions**: usar View Transitions API (estable en Next 16.2 vía React 19.2).

### 29.19 Duplicar entidades

Acción "Duplicar" en propuestas, facturas (como draft), tasks, line_items:

- Botón en el menú de acciones (`...`) de cada fila/detalle.
- Copia todos los campos editables, vacía los inmutables (`invoice_number`, `current_hash`, `public_token`, fechas de envío).
- Redirect a la nueva entidad en modo edición.

### 29.20 Exportar CSV

Toda tabla tiene botón "Exportar CSV" en su toolbar:

- Respeta los filtros activos.
- Server Action genera CSV en memoria (límite 10.000 filas), devuelve como descarga.
- Columnas: las visibles en la tabla + IDs internos para roundtrip.
- Helper `lib/csv.ts` con `escapeCsv`, `arrayToCsv`.

### 29.21 Notificaciones (campana en topbar)

Badge en el icono de campana con el contador de notificaciones sin leer:

- Tabla `notifications (id, member_id, type, title, body, entity_type, entity_id, read_at, created_at)`.
- Tipos: `proposal_accepted`, `proposal_rejected`, `invoice_paid`, `verifactu_rejected`,
  `task_assigned`, `mention`, `cert_expiring`.
- Popover al hacer click: lista paginada, agrupada por día. Click marca como leída.
- Supabase Realtime: suscripción a `notifications` filtrada por `member_id` → toast en vivo.

### 29.22 Mobile / responsive

Aunque es una herramienta interna desktop-first, debe ser usable en tablet (768px+):

- Sidebar colapsa a icon-only en < 1024px.
- Tablas pasan a vista de cards en < 768px (mostrar solo columnas críticas).
- Kanban: scroll horizontal en < 1024px.
- Editores (proposal, invoice): solo desktop ≥ 1024px (warning amigable en mobile).
- Portal público (`/p/*`): mobile-first obligatorio.

### 29.23 Dirty state warning

Si el usuario intenta navegar fuera de un form con cambios sin guardar:

- Hook `useUnsavedChanges(formState.isDirty)` que registra `beforeunload`.
- `next/navigation` router: confirm dialog antes de navegar.
- Excepción: si autosave está activo, no avisar (cambios persistidos automáticamente).

### 29.24 Microinteracciones

- **Botones**: hover transition 150ms en background y border.
- **Cards**: hover sutil (shadow + 1px translateY -1px).
- **Drag preview**: opacidad 0.7 y rotación 2deg al arrastrar (kanban, line_items).
- **Confirmaciones visuales**: checkmark animado al guardar/marcar como hecho.
- **Empty states**: ilustración con animación sutil al cargar.
- **Toasts**: slide-in desde abajo derecha, no centrados (no interrumpe el flujo).

Todas las animaciones < 300ms. Usar `transition-all duration-150 ease-out` por defecto.

### 29.25 Print y PDF

- CSS `@media print` para `/invoices/[id]` y `/proposals/[id]/preview`: oculta sidebar, toolbar, botones. Página A4.
- PDF de factura: generación server-side con Puppeteer (lambda) o `@react-pdf/renderer`.
  Decisión: empezar con CSS print + "Descargar PDF" que llama a un endpoint Puppeteer cuando se necesite (Phase 2 si imprime perfecto desde el navegador en MVP).

---

## 31. Testing strategy

Simple y directo: sólo Vitest. Sin frameworks adicionales, sin overhead de setup.

### 30.1 Stack de testing

- **Unit/integration**: `vitest@^3` + `@testing-library/react@^17` + `happy-dom`.
- **Type checking**: `tsc --noEmit` en CI.
- **Lint**: `eslint@^9` (flat config) + `@typescript-eslint` + `eslint-plugin-react-hooks`.
- **Formato**: `biome@^2`.

### 30.2 Qué se testea

| Capa | Qué se verifica |
|---|---|
| `lib/verifactu/hash.ts` | Hash chain reproducible con vectores fijos |
| `lib/verifactu/xml.ts` | XML generado contiene los campos obligatorios |
| `lib/verifactu/client.ts` modo `mock` | Devuelve respuestas simuladas según el modo |
| Server Action `sendToAeat` | Transiciones de estado correctas (mock client) |
| `lib/format.ts` | Casos límite: negativos, NIF inválido, IBAN con espacios |
| `lib/ratelimit.ts` | Respeta límites por IP y por user |

### 30.3 Qué NO se testea

- Componentes shadcn/ui, snapshots visuales, Realtime de Supabase, React Email.
- RLS y triggers DB: verificación manual en Supabase Studio durante desarrollo.
- E2E: flujos manuales mientras el equipo sea de 2 personas. Playwright en Phase 2.

### 30.4 Estructura

```
tests/
  fixtures/
    verifactu-vectors.json   — pares (input, hash esperado) oficiales AEAT
    sample-cert.p12          — cert autogenerado para tests (NO el real)
  unit/
    verifactu/
      hash.test.ts
      xml.test.ts
      client.test.ts
    format.test.ts
    ratelimit.test.ts
  integration/
    send-to-aeat.test.ts     — Server Action con mock del SOAP client
  helpers/
    seed.ts                  — factories: makeClient(), makeInvoice(), makeMember()
```

### 30.5 Comandos

```json
// package.json scripts
{
  "test":       "vitest run",
  "test:watch": "vitest",
  "typecheck":  "tsc --noEmit",
  "lint":       "eslint .",
  "format":     "biome format --write .",
  "check":      "pnpm lint && pnpm typecheck && pnpm test"
}
```

---

## 32. CI/CD pipeline

Pipeline mínimo y rápido (objetivo < 4 min para CI verde). Todo en GitHub Actions, deploys vía Vercel.

### 31.1 Workflow `ci.yml` (PRs y `main`)

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 8
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test

```

### 31.2 Deploys

- **Vercel Git integration** (no workflow custom): cada PR genera preview en `<branch>-doscientos.vercel.app`. Merge a `main` despliega producción en `app.doscientos.es`.
- **Migraciones de DB**: workflow separado `db-migrate.yml` con trigger manual (`workflow_dispatch`) — nunca automático en `main`. Aplica `supabase db push` contra el proyecto de producción usando `SUPABASE_ACCESS_TOKEN` y `SUPABASE_DB_PASSWORD` como secrets. El runbook está en `docs/runbook-migrations.md`.
- **Rollback**: Vercel "Promote previous deployment" + rollback de migración en Supabase Studio.

### 31.3 Branch protection (`main`)

- Require PR review (sólo dos miembros, se permite self-approve si el otro está fuera — settings flexible).
- Require status checks: `check`.
- Require branches to be up to date.
- Linear history (no merge commits).
- No force push, no delete.

### 31.4 Dependabot

`.github/dependabot.yml` agrupando updates:
- `npm` semanal, grouping por categoría (`prod`, `dev`, `types`).
- `github-actions` mensual.
- Auto-approve + auto-merge sólo para `patch` updates de devDependencies via workflow `dependabot-automerge.yml`.

### 31.5 Conventional commits + changelog

- `commitlint` + `husky` (pre-commit `pnpm check`, commit-msg conventional).
- `release-please` action para generar `CHANGELOG.md` automáticamente en cada release tag.
- Tags `vMAJOR.MINOR.PATCH` con changelog visible en `/settings/about` dentro de la app.

### 31.6 Observabilidad de CI

- Tiempo de cada job tracked en GitHub Insights.
- Si la mediana de `check` supera 3 min: revisar (probablemente install no está cacheado bien).
- Coverage report subido como comment en PR via `vitest --coverage` + `codecov-action` (opcional, sólo si llega a molestar la falta).

---

## 33. Implementation Steps

Orden sugerido para hacer el proyecto del tirón. Cada step es un bloque coherente de
funcionalidad que puede desplegarse y usarse en producción de forma independiente.

---

### Step 1 — Infraestructura, auth y pipelines
- Repo Next.js 16.2 App Router (Turbopack default), Tailwind 4 con tokens del design system (sec. 3), shadcn/ui, Pino (stdout)
- Supabase: proyecto, tablas team_members + settings, RLS con `current_member_role()`
- Supabase Auth: email/password, 2FA TOTP para owner/admin (sec. 6.1.1)
- `proxy.ts` (Next 16): protección de rutas, rate limiting (lru-cache en memoria), validación de rol
- Vercel: deploy, env vars, dominio app.doscientos.es
- `lib/logger.ts` (Pino → stdout), `lib/templates/render.ts` (sec. 29), `lib/format.ts` (sec. 30.17)
- **Testing setup (sec. 31)**: vitest + @testing-library/react, fixtures iniciales, scripts `pnpm check`
- **CI/CD (sec. 32)**: workflows `ci.yml` + `db-migrate.yml`, branch protection, dependabot, husky + commitlint
- Layout base: `<Sidebar>`, `<Topbar>`, `<PageHeader>` con tokens minimal Notion/Vercel
- `next-themes` con light por defecto + toggle en avatar dropdown
- Command palette skeleton (Cmd+K) y panel de atajos (Cmd+/) (sec. 30.7/30.8)

### Step 2 — Leads y pipeline
- Tablas: leads (con deleted_at), lead_interactions, reminders, activities
- Triggers DB: interactions_count, last_interaction_at, next_followup_at
- UI: kanban de leads (4 columnas, drag-and-drop @dnd-kit), ficha de lead, timeline
- Quick-add popover: llamada, email, WhatsApp, nota
- Vista /reminders con filtros y badges de urgencia
- Panel "Avisos" en /inicio (sec. 11.5): recordatorios próximos del usuario
- Integración landing → Supabase (reemplaza Notion/Google Sheets)
- Supabase Realtime: toast "Nuevo lead" en dashboard

### Step 3 — Clientes, proyectos y presupuestos
- Tablas: clients (con deleted_at), projects (con github_repo_owner/name), services_catalog
- Tablas: email_templates, proposals, line_items, proposal_items
- `lib/templates/render.ts`: interpolación de variables en subject/body
- Editor de propuesta: line items con drag-and-drop, totales automáticos con IVA
- Portal público `/p/proposal/[token]`: aceptar/rechazar con motivo
- Tracking de apertura: view_count, activities
- Preview interna idéntica a la vista del cliente
- notification_preferences: defaults por rol al crear team_member

### Step 4 — Facturas y suscripciones
- Tablas: invoices (todos los campos verifactu_* ya en schema), line_items, invoice_events
- Secuencia PostgreSQL para invoice_number (F-YYYY-NNN / R-YYYY-NNN)
- Generación de factura desde propuesta aceptada (pre-relleno)
- Milestones: pagos parciales, `is_payment_milestone`, trigger de progreso
- Portal público `/p/invoice/[token]`, CSS @media print, descarga PDF
- View `invoices_with_status` (computed_status='overdue' en runtime, sin cron)
- Panel "Avisos": sección de facturas vencidas con CTA
- Tabla subscriptions (schema preparado, sin generación automática hasta Phase 2)
- Idempotency key en `POST /api/crm/invoices` (header `Idempotency-Key`)

### Step 5 — Verifactu / SIF
- `lib/verifactu/`: hash.ts (SHA-256 chain), xml.ts, sign.ts, client.ts, qr.ts, utils.ts
- Trigger DB: inmutabilidad de `current_hash` y `chain_sequence` tras emisión
- Flujo de emisión: SELECT FOR UPDATE → computeHash → INSERT invoice_events 'issued'
- Server Action `sendToAeat` (sec. 18.2): botón "Enviar a AEAT" + "Reintentar" en /invoices/[id]
- Panel "Avisos": Verifactu pendiente/error + aviso certificado a 30 días
- QR PNG en Supabase Storage bucket `invoices-qr` (público) + QR en portal e impresión
- Flujo UI: factura rectificativa (botón, modal, serie R-YYYY-NNN)
- Toggle VERIFACTU_ENV test/prod en settings de la app
- Endpoints GDPR: `/api/gdpr/*/erase`, `/api/gdpr/*/export` (sec. 25.2)

### Step 6 — IA y dashboard
- API route `summarize-lead` (GPT-4o-mini): resumen + temperatura hot/warm/cold
- API route `draft-email` (GPT-4o): borrador en modal de email con contexto del lead
- KPI cards: leads activos, propuestas pendientes, facturación mensual, vencidas
- Gráficos recharts: bar (facturación por mes), donut (estado de leads), línea (nuevos leads)
- Buscador global Cmd+K (shadcn Command): leads, clientes, proyectos, facturas
- Filtros avanzados en todas las vistas, paginación en tablas grandes
- Responsive + dark/light mode

### Step 7 — Tasks y time tracking
- Tablas: tasks (project_id nullable, lead_id, LexoRank), task_comments, task_tags,
  task_tag_assignments, time_entries, notification_preferences
- ALTER milestones: start_date, completion_percentage, color, github_milestone_number, is_payment_milestone
- Trigger `update_milestone_progress()`
- RLS: todas las tablas nuevas con `current_member_role()`
- Vista Kanban por proyecto (4 columnas, @dnd-kit, fractional indexing)
- Vista Lista con subtareas indentadas, filtros, ordenación multi-columna
- TaskSheet: campos, markdown textarea + preview, subtareas, tags, timer de tiempo
- Quick-add inline de tareas en columna Kanban
- Time tracker: ▶ Iniciar / ⏹ Parar, badge en sidebar, validación 1 timer activo por miembro
- Botón "Importar horas no facturadas" en /projects/[id]/invoices (sec. 5.23 flujo)
- Menciones @handle: parseo en textarea, notify Realtime, email si inactivo >5 min
- Calendar ICS endpoint `/api/calendar/[memberId]/feed.ics` (sec. 28)
- Banner "Milestone 100% completado" con CTA si `is_payment_milestone`

### Step 8 — GitHub integration
- GitHub App: instalación en org, configurar repos por proyecto (github_repo_owner/name)
- Webhook `/api/github/webhook`: validar X-Hub-Signature-256, procesar eventos (sec. 20.3)
- API route `/api/github/create-issue`: crear issue desde tarea CRM
- Sync: issue closed → task done; PR opened → task github_pr_number; PR merged → task done
- github_handle en settings/profile de cada miembro
- Phase 2 (si se valida uso): Gantt visual, task_attachments UI, commits referenciando tareas

---

> **Dependencias entre steps**: cada step asume que el anterior está desplegado y funcionando.
> Los steps 5 (Verifactu) y 8 (GitHub) son independientes entre sí y pueden hacerse en paralelo
> si hay dos personas trabajando.

---

*Equipo: Pol (Frontend y Design) - Gerard (Backend y DevOps)*
*Stack: Next.js 16.2 (Turbopack) + React 19.2 + Supabase + shadcn/ui + Tailwind 4 + Resend + OpenAI + Vercel + Pino (stdout)*
*Referencia fiscal: Real Decreto 1619/2012 (facturacion) + RD 1007/2023 + Orden HAC/1177/2024 (Verifactu/SIF)*
*Última revisión: mayo 2026 — spec completa lista para implementación del tirón*
