/**
 * Helpers para leer y validar `searchParams` de forma tipada y sin duplicar
 * lógica entre páginas. Todas las funciones son puras (sin side-effects) y
 * trabajan con el objeto `Promise<Record<string, string | string[]>>` que
 * Next.js App Router expone a los Server Components.
 */

/** Escapa caracteres especiales de ILIKE para evitar inyección de patrones. */
export function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (m) => `\\${m}`);
}

type RawParams = Record<string, string | string[] | undefined>;

/** Lee un param como string normalizado (trim). Devuelve `""` si no existe. */
export function parseStringParam(
  params: RawParams,
  key: string,
  fallback = "",
): string {
  const raw = params[key];
  if (!raw) return fallback;
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? fallback;
}

/**
 * Lee un param como entero positivo.
 * Si el valor no es un entero válido ≥ 1, devuelve `fallback`.
 */
export function parseIntParam(
  params: RawParams,
  key: string,
  fallback = 1,
): number {
  const raw = parseStringParam(params, key);
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

/** Página de paginación (siempre ≥ 1). */
export function parsePage(params: RawParams): number {
  return parseIntParam(params, "page", 1);
}

/**
 * Lee un param sólo si su valor existe en `validValues`.
 * Devuelve `null` si el valor no es válido o no está presente.
 */
export function parseEnumParam<T extends string>(
  params: RawParams,
  key: string,
  validValues: readonly T[],
): T | null {
  const raw = parseStringParam(params, key);
  return (validValues as readonly string[]).includes(raw) ? (raw as T) : null;
}

export type SortDir = "asc" | "desc";

/**
 * Lee los params `sort` y `dir` y los valida contra una lista de columnas
 * permitidas. Si el valor no es válido, devuelve `defaultColumn` y `defaultDir`.
 */
export function parseSortParam(
  params: RawParams,
  validColumns: readonly string[],
  defaultColumn: string,
  defaultDir: SortDir = "asc",
): { sort: string; dir: SortDir } {
  const rawSort = parseStringParam(params, "sort");
  const rawDir = parseStringParam(params, "dir");
  const sort = (validColumns as readonly string[]).includes(rawSort) ? rawSort : defaultColumn;
  const dir: SortDir = rawDir === "asc" || rawDir === "desc" ? rawDir : defaultDir;
  return { sort, dir };
}
