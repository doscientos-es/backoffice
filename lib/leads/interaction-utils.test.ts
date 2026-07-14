import { describe, expect, it } from "vitest";
import { formatInteractionForAI, getCallInteractionDetails } from "./interaction-utils";

describe("getCallInteractionDetails", () => {
  it("reads call metadata from the interaction payload", () => {
    expect(
      getCallInteractionDetails({
        transcript: "  Hola, necesitamos una propuesta. ",
        duration_minutes: 18,
        outcome: "connected",
      }),
    ).toEqual({
      transcript: "Hola, necesitamos una propuesta.",
      durationMinutes: 18,
      outcome: "connected",
    });
  });

  it("ignores malformed or empty payloads", () => {
    expect(getCallInteractionDetails(null)).toEqual({
      transcript: null,
      durationMinutes: null,
      outcome: null,
    });
    expect(getCallInteractionDetails({ transcript: "  ", duration_minutes: "18" })).toEqual({
      transcript: null,
      durationMinutes: null,
      outcome: null,
    });
  });

  it("includes call notes and transcript in the AI context", () => {
    expect(
      formatInteractionForAI({
        type: "call",
        subject: "Llamada · Contactado",
        body: "Pide una propuesta esta semana.",
        payload: {
          transcript: "Habla de una migración urgente.",
          duration_minutes: 25,
          outcome: "connected",
        },
        created_at: "2026-07-14T10:00:00.000Z",
      }),
    ).toContain(
      "Notas: Pide una propuesta esta semana. | Resultado: connected · Duración: 25 min | Transcripción: Habla de una migración urgente.",
    );
    expect(
      formatInteractionForAI({
        type: "call",
        subject: null,
        body: null,
        payload: { duration_minutes: 25, outcome: "connected" },
        created_at: "2026-07-14T10:00:00.000Z",
      }),
    ).toContain("Resultado: connected · Duración: 25 min");
  });
});
