import { describe, expect, it } from "vitest";
import {
  getCallInteractionDetails,
  groupResendInteractions,
  interactionDate,
} from "./interaction-utils";

describe("groupResendInteractions", () => {
  it("groups repeated Resend callbacks for the same email and event type", () => {
    const result = groupResendInteractions([
      { id: "delivered-1", type: "email_delivered", resend_email_id: "email-1" },
      { id: "delivered-2", type: "email_delivered", resend_email_id: "email-1" },
      { id: "sent-1", type: "email_sent", resend_email_id: "email-1" },
      { id: "manual", type: "email_sent", resend_email_id: null },
    ]);

    expect(result).toEqual([
      { interaction: expect.objectContaining({ id: "delivered-1" }), count: 2 },
      { interaction: expect.objectContaining({ id: "sent-1" }), count: 1 },
      { interaction: expect.objectContaining({ id: "manual" }), count: 1 },
    ]);
  });
});

describe("call interaction dates", () => {
  it("uses the call date stored in metadata and otherwise keeps the audit timestamp", () => {
    const interaction = {
      type: "call",
      subject: "Llamada",
      body: null,
      created_at: "2026-08-17T10:00:00.000Z",
      payload: { call_date: "2026-08-10" },
    };

    expect(getCallInteractionDetails(interaction.payload).callDate).toBe("2026-08-10");
    expect(interactionDate(interaction)).toBe("2026-08-10");
    expect(interactionDate({ ...interaction, payload: {} })).toBe(interaction.created_at);
  });
});
