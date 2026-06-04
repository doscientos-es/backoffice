import { createHmac, timingSafeEqual } from "node:crypto";
import { LeadIntake } from "./lead-intake";

export type CalWebhookPayload = {
  triggerEvent: string;
  createdAt: string;
  payload: {
    uid: string;
    bookingId: number;
    title: string;
    startTime: string;
    endTime: string;
    attendees: Array<{
      email: string;
      name: string;
      timeZone: string;
    }>;
    organizer: {
      email: string;
      name: string;
    };
    additionalNotes?: string;
    metadata?: Record<string, any>;
  };
};

export function verifyCalSignature(secret: string, body: string, signature: string | null): boolean {
  if (!signature) return false;
  const hmac = createHmac("sha256", secret);
  const digest = hmac.update(body).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function mapCalToLeadIntake(payload: CalWebhookPayload): LeadIntake {
  const { triggerEvent, payload: booking } = payload;
  const guest = booking.attendees[0];

  return {
    name: guest?.name || "Guest",
    email: guest?.email || null,
    source: "cal.com",
    externalId: booking.uid,
    externalSource: "cal.com",
    notes: `Meeting: ${booking.title}\nStatus: ${triggerEvent}\nNotes: ${booking.additionalNotes || "none"}`,
    rawPayload: payload,
  };
}
