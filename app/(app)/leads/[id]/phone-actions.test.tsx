import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LeadWhatsAppButton } from "./phone-actions";

vi.mock("qrcode", () => ({ toDataURL: vi.fn() }));
vi.mock("@/lib/env", () => ({ publicEnv: { NEXT_PUBLIC_CAL_LINK: "" } }));
vi.mock("@/lib/recovery/utils", () => ({ buildBookingUrl: vi.fn(() => null) }));
vi.mock("../actions", () => ({ startLeadCall: vi.fn() }));

const props = {
  leadId: "lead-1",
  leadName: "María López",
  leadEmail: "maria@example.com",
  phone: "600 111 222",
  senderName: "Ana",
};

describe("LeadWhatsAppButton", () => {
  it("keeps the button available after the first contact with a brief greeting", () => {
    render(<LeadWhatsAppButton {...props} firstContactedAt="2026-08-07T10:00:00.000Z" />);

    const link = screen.getByRole("link", { name: "Preparar WhatsApp" });
    const message = new URL(link.getAttribute("href") ?? "", "https://example.com").searchParams.get(
      "text",
    );
    expect(message).toBe("Hola, María. Soy Ana, de Doscientos.");
  });

  it("uses the complete first-contact template before a lead is contacted", () => {
    render(<LeadWhatsAppButton {...props} firstContactedAt={null} />);

    const link = screen.getByRole("link", { name: "Preparar WhatsApp" });
    const message = new URL(link.getAttribute("href") ?? "", "https://example.com").searchParams.get(
      "text",
    );
    expect(message).toContain("He intentado llamarte porque rellenaste un formulario");
  });
});