/**
 * GET /api/social/google-business/callback
 *
 * Exchanges the one-time Google authorization code for a refresh token. The
 * token is shown only in the authenticated admin's browser and is never logged
 * or persisted by the application.
 */
import { requireRole } from "@/lib/auth";
import {
  exchangeGoogleBusinessCode,
  googleBusinessRedirectUri,
} from "@/lib/social/google-business";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATE_COOKIE = "google_business_oauth_state";

export async function GET(req: NextRequest) {
  try {
    await requireRole(["owner", "admin"]);
  } catch {
    return htmlPage(
      "Acceso denegado",
      `<p class="err">Necesitas permisos de administrador.</p>`,
      403,
    );
  }

  const { searchParams } = req.nextUrl;
  const oauthError = searchParams.get("error");
  if (oauthError) {
    return htmlPage("Error de Google", `<p class="err">${escapeHtml(oauthError)}</p>`, 400);
  }

  const state = searchParams.get("state");
  const savedState = req.cookies.get(STATE_COOKIE)?.value;
  if (!savedState || savedState !== state) {
    return htmlPage(
      "Error",
      `<p class="err">State inválido. Vuelve a iniciar el proceso.</p>`,
      400,
    );
  }

  const code = searchParams.get("code");
  if (!code) {
    return htmlPage("Error", `<p class="err">No se recibió el código de autorización.</p>`, 400);
  }

  try {
    const token = await exchangeGoogleBusinessCode(code);
    const response = htmlPage(
      "✅ Google Business Profile conectado",
      `
        <p>Autorización completada. Copia el refresh token en el gestor de secretos:</p>
        <pre id="token">${escapeHtml(token.refresh_token ?? "")}</pre>
        <button onclick="navigator.clipboard.writeText(document.getElementById('token').textContent)">
          📋 Copiar token
        </button>
        <p class="note">Variable: <code>GOOGLE_BUSINESS_REFRESH_TOKEN</code></p>
        <p class="note">Callback utilizado: <code>${escapeHtml(googleBusinessRedirectUri())}</code></p>
      `,
    );
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch (error) {
    return htmlPage(
      "Error de Google",
      `<p class="err">${escapeHtml(error instanceof Error ? error.message : "No se pudo obtener el token.")}</p>`,
      502,
    );
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char,
  );
}

function htmlPage(title: string, body: string, status = 200): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:680px;margin:4rem auto;padding:0 1rem;color:#111}h1{font-size:1.4rem}pre{background:#f4f4f5;padding:1rem;border-radius:8px;word-break:break-all;white-space:pre-wrap;font-size:.8rem}button{margin-top:.5rem;padding:.5rem 1rem;border:1px solid #ccc;border-radius:6px;cursor:pointer}.err{color:#b91c1c;font-weight:600}.note{color:#555;font-size:.875rem;margin-top:1rem}</style></head>
<body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
  return new NextResponse(html, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
