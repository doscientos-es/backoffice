/**
 * Standard discriminated-union result type for operations that can succeed or fail.
 *
 *   const res = await someAction(input);
 *   if (!res.ok) return handleError(res.error);
 *
 * Payload-carrying success can extend the success branch via the generic:
 *   ActionResult<{ id: string }>  →  { ok: true; id: string } | { ok: false; error: string }
 */
export type ActionResult<T = unknown> = T extends undefined | undefined
  ? { ok: true } | { ok: false; error: string }
  : ({ ok: true } & T) | { ok: false; error: string };
