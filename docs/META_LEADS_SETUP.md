# Conexión Meta Lead Ads → CRM doscientos

Guía paso a paso para conectar campañas de Facebook/Instagram Lead Ads de
forma que los leads aparezcan automáticamente en `/leads` con `source = meta_lead_ads`.

---

## 1. Endpoint del backoffice

- **URL pública**: `https://app.doscientos.es/api/webhooks/meta-leads`
  (en dev: `https://<tu-tunel-ngrok>/api/webhooks/meta-leads`)
- **Verificación (GET)**: responde el `hub.challenge` si `hub.verify_token` coincide con `META_VERIFY_TOKEN`.
- **Eventos (POST)**: valida `X-Hub-Signature-256` con `META_APP_SECRET` y hace upsert idempotente por `(external_source='meta_lead_ads', external_id=<leadgen_id>)`.

---

## 2. Variables de entorno

Añadir en Vercel (production + preview) y en `.env.local` (dev):

| Var                       | Descripción                                                                 |
| ------------------------- | --------------------------------------------------------------------------- |
| `META_APP_SECRET`         | App Secret de la app de Meta (Settings → Basic).                            |
| `META_VERIFY_TOKEN`       | String aleatorio que tú eliges. Lo usarás también en el panel de Meta.      |
| `META_PAGE_ACCESS_TOKEN`  | Page Access Token de larga duración (ver §4).                               |
| `META_GRAPH_API_VERSION`  | Opcional. Default `v23.0`.                                                  |

Sin estas variables el endpoint devuelve `503 webhook not configured` (build no se rompe).

---

## 3. Crear la App de Meta

1. Ir a https://developers.facebook.com → **My Apps → Create App**.
2. Tipo: **Business**. Asociar al Business Manager de doscientos.
3. En la app → **Settings → Basic**:
   - Copiar **App ID** y **App Secret** → `META_APP_SECRET`.
   - Añadir `app.doscientos.es` en _App Domains_.
4. Añadir el producto **Webhooks** y el producto **Marketing API**.

---

## 4. Page Access Token de larga duración

Lead Ads se consume con un **Page Access Token**, no con un user token.

1. En https://developers.facebook.com/tools/explorer:
   - Application: tu app.
   - User or Page: **Get Page Access Token** → seleccionar la página de doscientos.
   - Permissions: `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `leads_retrieval`, `ads_management`.
2. Generar token de usuario corto → llamar a:
   ```
   GET /oauth/access_token
     ?grant_type=fb_exchange_token
     &client_id={APP_ID}
     &client_secret={APP_SECRET}
     &fb_exchange_token={SHORT_USER_TOKEN}
   ```
   → obtienes un user token de 60 días.
3. Con ese user token:
   ```
   GET /me/accounts?access_token={LONG_USER_TOKEN}
   ```
   En la respuesta, el `access_token` de la página es de **vida indefinida**.
   Ese es el valor para `META_PAGE_ACCESS_TOKEN`.

⚠️ Guardar el token en Vercel env vars cifradas. No commitearlo.

---

## 5. Configurar el Webhook

1. App → **Webhooks → Add Subscription → Page**.
2. **Callback URL**: `https://app.doscientos.es/api/webhooks/meta-leads`.
3. **Verify Token**: el mismo valor que pusiste en `META_VERIFY_TOKEN`.
4. Pulsar **Verify and Save** → debe pasar (Meta hace un GET al endpoint).
5. En la lista de campos, suscribirse SOLO a `leadgen`.

---

## 6. Suscribir la página al webhook

Una vez la app está suscrita al objeto Page, hay que enganchar la página concreta:

```bash
curl -X POST "https://graph.facebook.com/v23.0/{PAGE_ID}/subscribed_apps?subscribed_fields=leadgen&access_token={PAGE_ACCESS_TOKEN}"
```

Verificar:

```bash
curl "https://graph.facebook.com/v23.0/{PAGE_ID}/subscribed_apps?access_token={PAGE_ACCESS_TOKEN}"
```

Debe aparecer tu app con `leadgen` en `subscribed_fields`.

---

## 7. App Review (solo si la página no es propia)

Para producción con páginas de terceros se necesita revisión de:
`leads_retrieval`, `pages_manage_metadata`, `pages_read_engagement`, `pages_show_list`.

Como la página es nuestra (doscientos), basta con añadirnos como **Tester** en
_App Roles_ y el webhook funciona en modo Development indefinidamente.

---

## 8. Probar end-to-end

1. Crear un formulario de prueba en Meta Business Suite → _Lead Forms_.
2. Lanzar un anuncio con presupuesto mínimo o usar **Lead Ads Testing Tool**:
   https://developers.facebook.com/tools/lead-ads-testing
3. Rellenar el formulario.
4. En segundos debe aparecer un lead nuevo en `/leads` con:
   - `source = meta_lead_ads`
   - `external_source = meta_lead_ads`, `external_id = <leadgen_id>`
   - `utm_source = facebook`, `utm_medium = paid_social`
   - `utm_campaign`, `utm_content`, `utm_term` con los IDs de campaña/ad/adset

---

## 9. Operación

- **Reintentos**: Meta reintenta hasta 36 h ante 5xx. Nuestro endpoint responde 200
  incluso en errores parciales (`partial: true` en el body) para evitar avalanchas.
- **Duplicados**: bloqueados por el índice único `(external_source, external_id)`.
  Si Meta reentrega un evento, `ingestLead` devuelve `duplicate: true` y no inserta.
- **Logs**: buscar `scope: meta-leads` en los logs de Vercel.
- **Rotación de secrets**: si rota el App Secret, actualizar `META_APP_SECRET` y
  redesplegar antes de que Meta vuelva a firmar con la nueva clave.

---

## 10. Añadir más fuentes después

`lib/integrations/lead-intake.ts` es genérico. Para Google Ads / LinkedIn / Tally:
crear un nuevo adapter en `lib/integrations/<provider>.ts` que devuelva un `LeadIntake`
y un endpoint en `app/api/webhooks/<provider>/route.ts`. El dedupe y normalización
se reutilizan tal cual.
