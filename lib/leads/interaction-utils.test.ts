import { describe, expect, it } from "vitest";
import { groupResendInteractions } from "./interaction-utils";

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
