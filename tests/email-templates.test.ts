import { appendSignature, extractVariables, renderTemplate } from "@/lib/email/templates";
import { describe, expect, it } from "vitest";

describe("renderTemplate", () => {
  it("replaces {{var}} placeholders", () => {
    const out = renderTemplate("Hola {{nombre}} de {{empresa}}", {
      nombre: "Pol",
      empresa: "doscientos",
    });
    expect(out).toBe("Hola Pol de doscientos");
  });

  it("leaves unknown variables untouched", () => {
    const out = renderTemplate("Hola {{nombre}}, {{unknown}}", { nombre: "Pol" });
    expect(out).toBe("Hola Pol, {{unknown}}");
  });

  it("handles null/undefined gracefully", () => {
    const out = renderTemplate("{{a}} {{b}}", { a: null, b: undefined });
    expect(out).toBe("{{a}} {{b}}");
  });
});

describe("appendSignature", () => {
  it("appends signature HTML when provided", () => {
    expect(appendSignature("<p>Hola</p>", "<p>--<br/>Pol</p>")).toContain("email-signature");
  });
  it("returns body untouched when signature is empty", () => {
    expect(appendSignature("<p>Hola</p>", null)).toBe("<p>Hola</p>");
  });
});

describe("extractVariables", () => {
  it("returns unique variable names", () => {
    expect(extractVariables("{{a}} {{b}} {{a}}")).toEqual(["a", "b"]);
  });
});
