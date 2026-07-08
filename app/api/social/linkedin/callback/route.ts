/**
 * GET /api/social/linkedin/callback
 *
 * LinkedIn OAuth 2.0 callback handler.
 *
 * Flow:
 *  1. Validates CSRF state cookie vs query param.
 *  2. Exchanges the authorization code for an access token.
 *  3. Returns an HTML page showing the token so the admin can copy it into
 *     LINKEDIN_ACCESS_TOKEN in .env.local and restart the server.
 *
 * The token is NOT stored anywhere automatically — it is displayed to the
 * authenticated admin only. This keeps the secret out of logs, DB, and code.
 */
import { serverEnv } from "@/lib/env";
import { scopedLogger } from "@/lib/logger";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = scopedLogger("social-linkedin.callback");

const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const STATE_COOKIE = "li_oauth_state";

interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // ── LinkedIn returned an error ────────────────────────────────────────────
  if (errorParam) {
    log.warn({ errorParam, errorDescription }, "LinkedIn OAuth error");
    return htmlPage("Error de LinkedIn", `<p class="err">${errorDescription ?? errorParam}</p>`);
  }

  // ── CSRF: compare state ───────────────────────────────────────────────────
  const savedState = req.cookies.get(STATE_COOKIE)?.value;
  if (!savedState || savedState !== state) {
    log.warn({ savedState, state }, "LinkedIn OAuth state mismatch — possible CSRF");
    return htmlPage("Error", `<p class="err">State inválido. Vuelve a iniciar el proceso.</p>`);
  }

  if (!code) {
    return htmlPage("Error", `<p class="err">No se recibió el código de autorización.</p>`);
  }

  const env = serverEnv();

  // ── Exchange code → access token ──────────────────────────────────────────
  let tokenData: LinkedInTokenResponse;
  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: env.LINKEDIN_REDIRECT_URI,
      client_id: env.LINKEDIN_CLIENT_ID,
      client_secret: env.LINKEDIN_CLIENT_SECRET,
    });

    const res = await fetch(LINKEDIN_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      log.error({ status: res.status, body: text }, "LinkedIn token exchange failed");
      return htmlPage("Error", `<p class="err">LinkedIn devolvió un error: ${res.status}</p>`);
    }

    tokenData = (await res.json()) as LinkedInTokenResponse;
  } catch (err) {
    log.error({ err }, "LinkedIn token request threw");
    return htmlPage("Error", `<p class="err">Error de red al contactar con LinkedIn.</p>`);
  }

  const expiresIn = Math.round(tokenData.expires_in / 86400);
  log.info({ scope: tokenData.scope, expiresInDays: expiresIn }, "LinkedIn token received");

  // Clear the state cookie
  const res = htmlPage(
    "✅ LinkedIn conectado",
    `
    <p>Token obtenido correctamente. Copia el valor y pégalo en <code>.env.local</code>:</p>
    <pre id="token">${tokenData.access_token}</pre>
    <button onclick="navigator.clipboard.writeText(document.getElementById('token').textContent)">
      📋 Copiar token
    </button>
    <p class="note">
      Expira en <strong>${expiresIn} días</strong> · Scopes: <code>${tokenData.scope}</code>
    </p>
    <p class="note">
      Añade esta línea a <code>.env.local</code> y reinicia el servidor:<br/>
      <code>LINKEDIN_ACCESS_TOKEN=&lt;el token copiado&gt;</code>
    </p>
  `,
  );
  res.cookies.delete(STATE_COOKIE);
  return res;
}

// ── HTML helper ──────────────────────────────────────────────────────────────

function htmlPage(title: string, body: string): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>${title} — LinkedIn OAuth</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:640px;margin:4rem auto;padding:0 1rem;color:#111}
    h1{font-size:1.4rem}
    pre{background:#f4f4f5;padding:1rem;border-radius:8px;word-break:break-all;white-space:pre-wrap;font-size:.8rem}
    button{margin-top:.5rem;padding:.5rem 1rem;border:1px solid #ccc;border-radius:6px;cursor:pointer}
    .err{color:#b91c1c;font-weight:600}
    .note{color:#555;font-size:.875rem;margin-top:1rem}
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${body}
</body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
