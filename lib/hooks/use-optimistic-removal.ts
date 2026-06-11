"use client";

import { useOptimistic, useTransition } from "react";
import { sileo } from "sileo";

type ActionResult = { ok: true } | { ok: false; error: string };

interface RemoveOptions {
  /** Runs once the server action settles (success or failure). */
  onSettled?: () => void;
  /** Overrides the toast text shown when the action fails. */
  errorMessage?: string;
}

/**
 * Optimistic removal for list/board contexts. The item disappears from the UI
 * immediately; while the server action is in flight `useOptimistic` keeps it
 * hidden. On success, server revalidation drops it from the source `items`, so
 * it stays gone. On failure, `items` is unchanged, React reverts the optimistic
 * state (the row reappears) and an error toast is shown.
 *
 * The source `items` MUST come from the server (props) so revalidation can win
 * the race against the reverting transition.
 */
export function useOptimisticRemoval<T extends { id: string }>(items: T[]) {
  const [optimisticItems, dropOptimistic] = useOptimistic(items, (state, id: string) =>
    state.filter((it) => it.id !== id),
  );
  const [pending, startTransition] = useTransition();

  const remove = (id: string, action: () => Promise<ActionResult>, options?: RemoveOptions) => {
    startTransition(async () => {
      dropOptimistic(id);
      const res = await action();
      if (!res.ok) sileo.error({ title: options?.errorMessage ?? res.error });
      options?.onSettled?.();
    });
  };

  return { items: optimisticItems, remove, pending };
}
