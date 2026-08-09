import { describe, expect, it } from "vitest";
import { formatOutboxError } from "./outbox";

describe("formatOutboxError", () => {
  it("preserves the AEAT code with its actionable description", () => {
    expect(
      formatOutboxError(null, {
        aeatCode: "4102",
        errorMessage: "NIF del destinatario no válido",
      }),
    ).toBe("AEAT 4102: NIF del destinatario no válido");
  });

  it("preserves a technical error without inventing an AEAT code", () => {
    expect(formatOutboxError("Certificado P12 inválido", null)).toBe("Certificado P12 inválido");
  });
});