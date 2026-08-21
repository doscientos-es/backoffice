import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { completePasskeyAuthentication, preparePasskeyAuthentication, sendToAeat } = vi.hoisted(
  () => ({
    completePasskeyAuthentication: vi.fn(),
    preparePasskeyAuthentication: vi.fn(),
    sendToAeat: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../actions", () => ({ sendToAeat }));
vi.mock("@/lib/security/webauthn-client", () => ({
  completePasskeyAuthentication,
  preparePasskeyAuthentication,
}));

import { SendAeatButton } from "./send-aeat-button";

describe("SendAeatButton", () => {
  const options = { challenge: "challenge" };

  beforeEach(() => {
    vi.clearAllMocks();
    preparePasskeyAuthentication.mockResolvedValue({ ok: true, options });
    completePasskeyAuthentication.mockResolvedValue({ ok: true });
    sendToAeat.mockResolvedValue({ ok: true, status: "accepted", csv: "CSV-123" });
  });

  it("prepares the challenge before a distinct click starts Windows Hello", async () => {
    render(<SendAeatButton invoiceId="invoice-1" label="Reintentar envío" />);

    fireEvent.click(screen.getByRole("button", { name: "Reintentar envío" }));

    await waitFor(() =>
      expect(preparePasskeyAuthentication).toHaveBeenCalledWith({
        intent: "invoice.send_aeat",
        resource: "invoice:invoice-1",
      }),
    );
    expect(completePasskeyAuthentication).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole("button", { name: "Confirmar con Windows Hello" }));

    await waitFor(() =>
      expect(completePasskeyAuthentication).toHaveBeenCalledWith(
        { intent: "invoice.send_aeat", resource: "invoice:invoice-1" },
        options,
      ),
    );
    await waitFor(() => expect(sendToAeat).toHaveBeenCalledOnce());
    const [formData] = sendToAeat.mock.calls[0] as [FormData];
    expect(formData.get("id")).toBe("invoice-1");
  });
});
