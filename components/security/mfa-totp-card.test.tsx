import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mfa } = vi.hoisted(() => ({
  mfa: {
    listFactors: vi.fn(),
    enroll: vi.fn(),
    challengeAndVerify: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/browser", () => ({
  getBrowserClient: () => ({ auth: { mfa } }),
}));

import { MfaTotpCard } from "./mfa-totp-card";

describe("MfaTotpCard", () => {
  beforeEach(() => {
    mfa.listFactors.mockReset().mockResolvedValue({ data: { totp: [] }, error: null });
    mfa.enroll.mockReset().mockResolvedValue({
      data: { id: "factor-1", totp: { qr_code: "data:image/svg+xml,test" } },
      error: null,
    });
    mfa.challengeAndVerify.mockReset().mockResolvedValue({ error: null });
  });

  it("explains that MFA is required for administrators and starts enrollment", async () => {
    render(<MfaTotpCard required />);

    expect(await screen.findByText(/obligatoria para administrar/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /configurar mfa/i }));

    await waitFor(() => expect(mfa.enroll).toHaveBeenCalledOnce());
    expect(screen.getByRole("img", { name: /código qr/i }).getAttribute("src")).toContain(
      "data:image/svg+xml,test",
    );
  });

  it("shows an active state for a verified TOTP factor", async () => {
    mfa.listFactors.mockResolvedValue({
      data: { totp: [{ id: "factor-1", status: "verified" }] },
      error: null,
    });
    render(<MfaTotpCard required={false} />);

    expect(await screen.findByText("Activa")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /configurar mfa/i })).toBeNull();
  });
});
