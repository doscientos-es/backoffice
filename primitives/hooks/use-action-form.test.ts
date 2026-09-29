import { act, renderHook } from "@testing-library/react";
import type { FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";

import { useActionForm } from "@/primitives/hooks/use-action-form";

function submitEvent(): FormEvent<HTMLFormElement> {
  const form = document.createElement("form");
  return { preventDefault: vi.fn(), currentTarget: form } as unknown as FormEvent<HTMLFormElement>;
}

describe("useActionForm", () => {
  it("ignores a second submit while the first is in flight", async () => {
    let resolve: (value: { ok: true }) => void = () => {};
    const action = vi.fn(() => new Promise<{ ok: true }>((r) => (resolve = r)));
    const { result } = renderHook(() => useActionForm(action));

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.onSubmit(submitEvent());
    });
    await act(() => result.current.onSubmit(submitEvent()));
    expect(action).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve({ ok: true });
      await first;
    });
    expect(result.current.state.status).toBe("success");
  });

  it("shows an error instead of hanging when the action throws", async () => {
    const action = vi.fn().mockRejectedValue(new Error("Failed to fetch"));
    const { result } = renderHook(() => useActionForm(action));

    await act(() => result.current.onSubmit(submitEvent()));

    expect(result.current.pending).toBe(false);
    expect(result.current.state).toEqual({
      status: "error",
      message: "No se pudo conectar con el servidor. Inténtalo de nuevo.",
    });
  });

  it("rethrows Next.js navigation errors", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;push;/x" });
    const action = vi.fn().mockRejectedValue(redirect);
    const { result } = renderHook(() => useActionForm(action));

    await expect(act(() => result.current.onSubmit(submitEvent()))).rejects.toBe(redirect);
  });

  it("resets to idle when onFailure handles the error", async () => {
    const action = vi.fn().mockResolvedValue({ ok: false, error: "conflict", code: "conflict" });
    const { result } = renderHook(() => useActionForm(action, { onFailure: () => true }));

    await act(() => result.current.onSubmit(submitEvent()));

    expect(result.current.state.status).toBe("idle");
  });

  it("surfaces the action error message", async () => {
    const action = vi.fn().mockResolvedValue({ ok: false, error: "Nombre obligatorio" });
    const { result } = renderHook(() => useActionForm(action));

    await act(() => result.current.onSubmit(submitEvent()));

    expect(result.current.state).toEqual({ status: "error", message: "Nombre obligatorio" });
  });
});
