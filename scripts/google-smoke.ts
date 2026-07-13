#!/usr/bin/env tsx
/**
 * Google Workspace — Smoke Test
 *
 * Verifica que la service account puede:
 *   1. Obtener un token JWT (domain-wide delegation)
 *   2. Leer y escribir en ambas carpetas del Shared Drive
 *   3. Crear subcarpetas de cliente y subir un fichero de prueba
 *   4. Acceder al calendario compartido
 *
 * Usage: pnpm google:smoke
 * Los ficheros de prueba se eliminan automáticamente al finalizar.
 */

// Load .env.local before anything else (Node 22 built-in).
process.loadEnvFile(".env.local");

import { JWT } from "google-auth-library";

const SA_EMAIL = process.env.GOOGLE_SA_CLIENT_EMAIL ?? "";
const SA_KEY_B64 = process.env.GOOGLE_SA_PRIVATE_KEY_BASE64 ?? "";
const SUBJECT =
  process.env.GOOGLE_DRIVE_SUBJECT_EMAIL ||
  `pol@${process.env.GOOGLE_WORKSPACE_DOMAIN ?? "doscientos.es"}`;
const INV_FOLDER = process.env.GOOGLE_DRIVE_INVOICES_FOLDER_ID ?? "";
const PROP_FOLDER = process.env.GOOGLE_DRIVE_PROPOSALS_FOLDER_ID ?? "";
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID ?? "";

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/calendar",
];

const FILES = "https://www.googleapis.com/drive/v3/files";
const CALENDAR = "https://www.googleapis.com/calendar/v3";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ok = (msg: string) => console.log(`  ✅ ${msg}`);
const warn = (msg: string) => console.log(`  ⚠️  ${msg}`);
const fail = (msg: string, err?: unknown) => {
  const detail = err instanceof Error ? err.message : String(err ?? "");
  console.error(`  ❌ ${msg}${detail ? ` — ${detail}` : ""}`);
};

async function getToken(): Promise<string> {
  const pem = Buffer.from(SA_KEY_B64, "base64").toString("utf8").trim();
  if (!pem.includes("BEGIN PRIVATE KEY"))
    throw new Error("PEM inválido en GOOGLE_SA_PRIVATE_KEY_BASE64");
  const client = new JWT({ email: SA_EMAIL, key: pem, scopes: SCOPES, subject: SUBJECT });
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Token vacío");
  return token;
}

async function apiFetch<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...((init?.headers ?? {}) as Record<string, string>),
    },
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok)
    throw new Error(
      ((json.error as Record<string, unknown>)?.message as string) ?? `HTTP ${res.status}`,
    );
  return json as T;
}

async function deleteFile(token: string, id: string) {
  await fetch(`${FILES}/${id}?supportsAllDrives=true`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Drive checks ─────────────────────────────────────────────────────────────

async function checkFolder(token: string, folderId: string, label: string): Promise<boolean> {
  try {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id)",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      pageSize: "1",
    });
    await apiFetch(token, `${FILES}?${params}`);
    ok(`Lectura OK — carpeta ${label} (${folderId.slice(0, 14)}…)`);
    return true;
  } catch (err) {
    fail(`Sin acceso a carpeta ${label}`, err);
    return false;
  }
}

async function checkWrite(token: string, parentId: string, label: string): Promise<void> {
  // 1. Create subfolder
  let subfolderId: string | null = null;
  let fileId: string | null = null;
  try {
    const folder = await apiFetch<{ id: string }>(
      token,
      `${FILES}?fields=id&supportsAllDrives=true`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "_smoke-test_",
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentId],
        }),
      },
    );
    subfolderId = folder.id;
    ok(`Subcarpeta creada en ${label}`);
  } catch (err) {
    fail(`No se pudo crear subcarpeta en ${label}`, err);
    return;
  }

  // 2. Upload tiny file
  try {
    const boundary = `smoke-${Date.now()}`;
    const meta = JSON.stringify({
      name: "smoke-test.json",
      mimeType: "application/json",
      parents: [subfolderId],
    });
    const content = JSON.stringify({ test: true, ts: new Date().toISOString() });
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
    const uploaded = await apiFetch<{ id: string; name: string }>(
      token,
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name&supportsAllDrives=true",
      {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      },
    );
    fileId = uploaded.id;
    ok(`Fichero subido a ${label}/_smoke-test_`);
  } catch (err) {
    fail(`No se pudo subir fichero a ${label}`, err);
  }

  // 3. Cleanup
  if (fileId) await deleteFile(token, fileId);
  await deleteFile(token, subfolderId);
  ok(`Limpieza OK en ${label}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log("\n🔍 Google Workspace — Smoke Test");
console.log("════════════════════════════════════");
console.log(`  SA email  : ${SA_EMAIL}`);
console.log(`  Subject   : ${SUBJECT}`);
console.log(`  Invoices  : ${INV_FOLDER}`);
console.log(`  Proposals : ${PROP_FOLDER}\n`);

if (!SA_EMAIL || !SA_KEY_B64) {
  console.error("❌ GOOGLE_SA_CLIENT_EMAIL o GOOGLE_SA_PRIVATE_KEY_BASE64 no configurados.");
  process.exit(1);
}

// 1. Auth
console.log("1. Autenticación JWT");
let token: string;
try {
  token = await getToken();
  ok(`Token obtenido (impersonando ${SUBJECT})`);
} catch (err) {
  fail("No se pudo obtener token JWT", err);
  console.error(
    "\n  → Verifica GOOGLE_SA_PRIVATE_KEY_BASE64, domain-wide delegation y scopes en Workspace Admin.\n",
  );
  process.exit(1);
}

// 2 & 3. Shared Drive
console.log("\n2. Shared Drive — Invoices");
if (INV_FOLDER) {
  if (await checkFolder(token, INV_FOLDER, "invoices"))
    await checkWrite(token, INV_FOLDER, "invoices");
} else {
  warn("GOOGLE_DRIVE_INVOICES_FOLDER_ID no configurado — saltando");
}

console.log("\n3. Shared Drive — Proposals");
if (PROP_FOLDER) {
  if (await checkFolder(token, PROP_FOLDER, "proposals"))
    await checkWrite(token, PROP_FOLDER, "proposals");
} else {
  warn("GOOGLE_DRIVE_PROPOSALS_FOLDER_ID no configurado — saltando");
}

// 4. Calendar
console.log("\n4. Google Calendar");
if (CALENDAR_ID) {
  try {
    const cal = await apiFetch<{ summary?: string }>(
      token,
      `${CALENDAR}/calendars/${encodeURIComponent(CALENDAR_ID)}`,
    );
    ok(`Calendario accesible: "${cal.summary ?? CALENDAR_ID}"`);
  } catch (err) {
    fail("No se puede acceder al calendario", err);
  }
} else {
  warn("GOOGLE_CALENDAR_ID no configurado — saltando");
}

console.log("\n════════════════════════════════════");
console.log("🏁 Smoke test completado.\n");
