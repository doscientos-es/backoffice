"use client";

import { useState, useTransition } from "react";
import { sileo } from "sileo";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Optimistic scalar-field update hook.
 *
 * `value` reflects the new state immediately. If the server action returns
 * `{ ok: false }` the previous value is restored and an error toast fires.
 *
 * @example
 * const { value, commit } = useOptimisticUpdate(serverStatus);
 * commit(next, () => updateStatus({ id, status: next }));
 */
export function useOptimisticUpdate<T>(initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [, startTransition] = useTransition();

  const commit = (next: T, action: () => Promise<ActionResult | undefined>) => {
    const prev = value;
    setValue(next); // optimistic
    startTransition(async () => {
      const res = await action();
      if (res && !res.ok) {
        setValue(prev); // revert
        sileo.error({ title: res.error });
      }
    });
  };

  return { value, commit };
}
