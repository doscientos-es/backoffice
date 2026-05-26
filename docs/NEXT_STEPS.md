# NEXT_STEPS — acciones manuales pendientes

Lista cerrada de cosas que **debes hacer tú** porque requieren acceso humano (paneles externos, DNS, certificados, claves privadas). Todo lo demás (código, schema, migraciones, CI) ya está hecho.

> Repo: `https://github.com/PolGubau/backoffice-doscientos`
> Supabase: proyecto `backoffice-doscientos` (ref `hnzyllbksqvamqfubhri`, region `eu-west-1`, org `doscientos`) — **ya creado y con migraciones aplicadas**.

---

## 1. Variables de entorno (Vercel + `.env.local`)

Copia `.env.example` a `.env.local` y rellena. Las mismas variables deben estar en Vercel (Project → Settings → Environment Variables, scope `Production`, `Preview`, `Development`).

### Públicas (browser)

| Variable | Dónde obtenerla |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL (`https://hnzyllbksqvamqfubhri.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` / `publishable` key |
| `NEXT_PUBLIC_APP_URL` | `https://app.doscientos.es` (prod) / `http://localhost:3000` (dev) |

### Servidor (NUNCA exponer al cliente)

| Variable | Dónde obtenerla |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` / `secret` key |
| `RESEND_API_KEY` | Resend → API Keys → Create (scope: `Sending access`, dominio `doscientos.es`) |
| `RESEND_WEBHOOK_SECRET` | Resend → Webhooks → Create endpoint → copia el `signing secret` |
| `RESEND_FROM_DOMAIN` | `doscientos.es` |
| `VERIFACTU_ENV` | `mock` (sin certificado) / `test` (sandbox AEAT) / `prod` |
| `VERIFACTU_NIF` | NIF del emisor (Doscientos S.L.) |
| `AEAT_CERT_BASE64` | Cuando tengas certificado FNMT: `base64 -w0 cert.p12` |
| `AEAT_CERT_PASSWORD` | Password del `.p12` |

> Mientras `VERIFACTU_ENV=mock`, las 3 últimas pueden quedar vacías.

---

## 2. Resend — verificar dominio (10 min, gratis, una sola vez)

1. https://resend.com → **Domains** → **Add Domain** → `doscientos.es`.
2. Resend te muestra 3 registros DNS. Añádelos en tu proveedor del dominio (IONOS/Cloudflare/etc.):
   - `TXT @` — SPF (`v=spf1 include:_spf.resend.com ~all` o el que indique Resend si ya tienes SPF, combinarlo).
   - `TXT resend._domainkey` — DKIM.
   - `TXT _dmarc` — DMARC (`v=DMARC1; p=none;`).
3. Espera propagación (5–30 min) → botón **Verify**.
4. Una vez verificado, podrás enviar desde cualquier alias `*@doscientos.es`.
5. Crea el webhook: **Webhooks → Add endpoint** → `https://app.doscientos.es/api/email/webhook` → eventos `email.sent`, `email.delivered`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked` → copia el **Signing Secret** a `RESEND_WEBHOOK_SECRET`.

---

## 3. Vercel — crear proyecto y conectar dominio

1. https://vercel.com → **Add New → Project** → importa `PolGubau/backoffice-doscientos`.
2. Framework Preset: **Next.js** (auto-detectado). Root directory: `./`.
3. Antes de hacer **Deploy**, añade todas las variables de la sección 1.
4. Tras el primer deploy: **Settings → Domains → Add `app.doscientos.es`**.
5. Vercel mostrará un `CNAME`. En tu DNS del dominio:
   - `CNAME app → cname.vercel-dns.com.`
6. Espera propagación y verifica HTTPS automático (Let's Encrypt).

> Alternativa CLI: con la sesión actual de Augment puedes ejecutar `deploy_to_vercel` y crearé el proyecto y el primer deploy (se vinculará al repo y a tu cuenta). Las env vars siguen siendo manuales.

---

## 4. Supabase — Auth

1. https://supabase.com/dashboard/project/hnzyllbksqvamqfubhri
2. **Authentication → Providers → Email**: activa, desactiva sign-up público (solo invitaciones), confirm email **ON**.
3. **Authentication → URL Configuration**:
   - Site URL: `https://app.doscientos.es`
   - Redirect URLs: `https://app.doscientos.es/auth/callback`, `http://localhost:3000/auth/callback`.
4. **Authentication → Users → Invite user**: invítate a ti mismo con rol owner (luego desde la app `/settings/team` se asigna en `team_members`).
5. Tras el primer login, ejecuta en SQL Editor para crear el `team_member`:

   ```sql
   insert into team_members (id, email, name, role, email_send_enabled, email_alias)
   values ('<tu-auth-uid>', 'pol@doscientos.es', 'Pol Gubau', 'owner', true, 'pol');
   ```

---

## 5. AEAT — Verifactu producción (cuando proceda)

> Mientras estés en `mock` puedes saltar esto.

1. Solicita certificado FNMT de **representante de persona jurídica** (`Doscientos S.L.`).
2. Exporta a `.p12` con password.
3. Convierte a base64: `cat cert.p12 | base64 -w0 > cert.b64` → pega el contenido en `AEAT_CERT_BASE64` en Vercel.
4. Cambia `VERIFACTU_ENV=test` (sandbox) y prueba envío de una factura ficticia. Cuando AEAT confirme integridad de la cadena, pasa a `VERIFACTU_ENV=prod`.

---

## 6. Verificación final

- `https://app.doscientos.es` carga la pantalla de login.
- Login con email funciona.
- Sidebar muestra todas las rutas.
- Health check Supabase: el `inicio` no muestra errores en consola.
- Webhook Resend: enviar email de prueba desde `/leads/[id]` → ver evento `delivered` en `lead_interactions`.

---

## 7. Estado actual del repo

| Pieza | Estado |
|---|---|
| Código (Next 16 + React 19 + Tailwind 4 + Supabase + Resend + Verifactu) | ✅ pusheado a `main` |
| Migraciones (`init`, `proposals_invoices`, `misc_tables`, `rls`) | ✅ aplicadas a `hnzyllbksqvamqfubhri` |
| CI (lint + typecheck + vitest) | ✅ corre en cada push |
| Vercel project | ⏳ pendiente (sección 3) |
| Resend dominio | ⏳ pendiente (sección 2) |
| AEAT cert | ⏳ opcional (sección 5) |
