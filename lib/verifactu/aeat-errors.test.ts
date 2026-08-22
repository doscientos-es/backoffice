import { describe, expect, it } from "vitest";
import { extractAeatErrorCode, getAeatErrorMetadata } from "./aeat-errors";

describe("AEAT VeriFactu error metadata", () => {
  it.each([
    ["4102", "full_submission_rejected"],
    ["3501", "full_submission_rejected"],
    ["1100", "record_rejected"],
    ["3000", "record_rejected"],
    ["2001", "accepted_with_errors"],
  ] as const)("classifies official code %s", (code, effect) => {
    expect(getAeatErrorMetadata(code)?.effect).toBe(effect);
  });

  it("extracts an official code from a persisted AEAT error", () => {
    expect(extractAeatErrorCode("AEAT 4102: El XML no cumple el esquema")).toBe("4102");
  });

  it("does not confuse an HTTP status or a year with an AEAT error code", () => {
    expect(extractAeatErrorCode("AEAT HTTP 500: fecha no permitida en 2024")).toBeNull();
  });

  it("falls back to the persisted detail when a structured code is unavailable", () => {
    expect(getAeatErrorMetadata(null, "Código: 2005. Importe incorrecto")).toMatchObject({
      code: "2005",
      effect: "accepted_with_errors",
    });
  });
});
