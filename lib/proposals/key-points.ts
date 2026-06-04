/**
 * Structured narrative blocks ("key points") used by the proposal editor,
 * the public portal and the deck. Each problem and solution is stored as an
 * ordered list of `{ id, title, description }` so the deck can render them
 * as numbered cards instead of a wall of markdown.
 *
 * This module is the single source of truth for the wire shape: the schema
 * (`lib/schemas/proposal.ts`), the server action and every UI surface go
 * through `parseKeyPoints` / `serializeKeyPoints` to keep storage and runtime
 * representations in sync.
 */

export const KEY_POINTS_LIMITS = {
  /** Hard cap on how many points a single block can hold. */
  maxCount: 20,
  maxTitleLength: 200,
  maxDescriptionLength: 2000,
} as const;

export type KeyPoint = {
  id: string;
  title: string;
  description: string | null;
};

/** UI-side variant: description is always a string so `<Textarea>` is happy. */
export type EditableKeyPoint = {
  id: string;
  title: string;
  description: string;
};

export function createEmptyKeyPoint(): EditableKeyPoint {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `kp-${Math.random().toString(36).slice(2, 10)}`,
    title: "",
    description: "",
  };
}

/**
 * Parse a JSON value coming from Supabase into a normalised list of key
 * points. Tolerates `null`, malformed entries and missing fields; entries
 * without a title are dropped because they would render as empty cards.
 */
export function parseKeyPoints(value: unknown): KeyPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v, i): KeyPoint => {
      const title = typeof v.title === "string" ? v.title.trim() : "";
      const description =
        typeof v.description === "string" && v.description.trim().length > 0 ? v.description : null;
      const id = typeof v.id === "string" && v.id.length > 0 ? v.id : `kp-${i}`;
      return { id, title, description };
    })
    .filter((kp) => kp.title.length > 0);
}

/** Hydrate a stored list into the editable shape used by `<KeyPointsEditor>`. */
export function toEditableKeyPoints(items: KeyPoint[]): EditableKeyPoint[] {
  return items.map((kp) => ({
    id: kp.id,
    title: kp.title,
    description: kp.description ?? "",
  }));
}

/**
 * Serialise an editable list for the server action / database. Drops blank
 * entries (no title) and trims whitespace. Returns `null` instead of `[]` so
 * the storage column can be cleared with a single assignment, mirroring the
 * "" → null collapse the schema does for the other markdown fields.
 */
export function serializeKeyPoints(items: EditableKeyPoint[]): KeyPoint[] | null {
  const cleaned: KeyPoint[] = [];
  for (const item of items) {
    const title = item.title.trim();
    if (title.length === 0) continue;
    const description = item.description.trim();
    cleaned.push({
      id: item.id,
      title,
      description: description.length > 0 ? description : null,
    });
  }
  return cleaned.length > 0 ? cleaned : null;
}
