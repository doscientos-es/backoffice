import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WhatsAppComposer } from "./whatsapp-composer";

const { logLeadWhatsApp } = vi.hoisted(() => ({
  logLeadWhatsApp: vi.fn(async () => ({ ok: true as const })),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/env", () => ({ publicEnv: { NEXT_PUBLIC_CAL_LINK: "" } }));
vi.mock("@/lib/recovery/utils", () => ({ buildBookingUrl: () => null }));
vi.mock("./actions", () => ({ logLeadWhatsApp }));

describe("WhatsAppComposer", () => {
  it("only records the message after WhatsApp was opened and the send was confirmed", async () => {
    render(
      <WhatsAppComposer
        leadId="00000000-0000-0000-0000-000000000001"
        leadName="María López"
        leadEmail="maria@example.com"
        leadPhone="600 111 222"
        senderName="Ana"
        defaultMessage="Hola María"
      />,
    );

    expect(screen.queryByRole("button", { name: "Confirmar enviado" })).toBeNull();
    expect(logLeadWhatsApp).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("link", { name: "Abrir WhatsApp" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar enviado" }));

    await waitFor(() =>
      expect(logLeadWhatsApp).toHaveBeenCalledWith({
        leadId: "00000000-0000-0000-0000-000000000001",
        content: "Hola María\n\n— Ana",
      }),
    );
  });

  it("requires reopening WhatsApp after editing the prepared message", () => {
    render(
      <WhatsAppComposer
        leadId="00000000-0000-0000-0000-000000000001"
        leadName="María López"
        leadEmail={null}
        leadPhone="600 111 222"
        senderName="Ana"
        defaultMessage="Hola María"
      />,
    );

    fireEvent.click(screen.getByRole("link", { name: "Abrir WhatsApp" }));
    expect(screen.getByRole("button", { name: "Confirmar enviado" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Mensaje"), { target: { value: "Texto nuevo" } });
    expect(screen.queryByRole("button", { name: "Confirmar enviado" })).toBeNull();
  });
});
