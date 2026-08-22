import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { completePasskeyAuthentication, preparePasskeyAuthentication, regularizeVerifactu } =
  vi.hoisted(() => ({
    completePasskeyAuthentication: vi.fn(),
    preparePasskeyAuthentication: vi.fn(),
    regularizeVerifactu: vi.fn(),
  }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../actions", () => ({ regularizeVerifactu }));
vi.mock("@/lib/security/webauthn-client", () => ({
  completePasskeyAuthentication,
  preparePasskeyAuthentication,
}));

import { RegularizeAeatButton } from "./regularize-aeat-button";

describe("RegularizeAeatButton", () => {
  const options = { challenge: "challenge" };

  beforeEach(() => {
    vi.clearAllMocks();
    preparePasskeyAuthentication.mockResolvedValue({ ok: true, options });
    completePasskeyAuthentication.mockResolvedValue({ ok: true });
    regularizeVerifactu.mockResolvedValue({ ok: true, status: "accepted", csv: "CSV-123" });
  });

  it("requires a scoped passkey verification before creating a regularization", async () => {
    render(<RegularizeAeatButton invoiceId="invoice-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Regularizar rechazo AEAT" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar con la regularización" }));

    await waitFor(() =>
      expect(preparePasskeyAuthentication).toHaveBeenCalledWith({
        intent: "invoice.verifactu_regularize",
        resource: "invoice:invoice-1",
      }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar con biometría" }));

    await waitFor(() =>
      expect(completePasskeyAuthentication).toHaveBeenCalledWith(
        { intent: "invoice.verifactu_regularize", resource: "invoice:invoice-1" },
        options,
      ),
    );
    await waitFor(() => expect(regularizeVerifactu).toHaveBeenCalledOnce());
  });
});
