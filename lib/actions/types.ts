/**
 * Standard discriminated-union result returned by server actions that are
 * invoked from client components (i.e. NOT redirect-based form actions).
 *
 *   const res = await updateClient(input);
 *   if (!res.ok) return toast.error(res.error);
 *
 * Payload-carrying success can extend the success branch via the generic:
 *   ActionResult<{ id: string }>  →  { ok: true; id: string } | { ok: false; error: string }
 */
export type ActionResult<T = unknown> = T extends undefined | undefined
  ? { ok: true } | { ok: false; error: string }
  : ({ ok: true } & T) | { ok: false; error: string };
