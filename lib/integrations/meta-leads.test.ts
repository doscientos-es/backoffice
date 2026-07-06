import { createHmac } from "node:crypto";
import {
  type MetaLeadgenResponse,
  mapMetaLeadgenToIntake,
  verifyMetaSignature,
} from "@/lib/integrations/meta-leads";
import { describe, expect, it } from "vitest";

const APP_SECRET = "test_app_secret_value";

function sign(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

describe("verifyMetaSignature", () => {
  it("accepts a correctly-signed payload", () => {
    const body = JSON.stringify({ object: "page", entry: [] });
    expect(verifyMetaSignature(APP_SECRET, body, sign(APP_SECRET, body))).toBe(true);
  });

  it("accepts signature without sha256= prefix", () => {
    const body = "payload";
    const hex = sign(APP_SECRET, body).slice(7);
    expect(verifyMetaSignature(APP_SECRET, body, hex)).toBe(true);
  });

  it("rejects tampered body", () => {
    const body = JSON.stringify({ object: "page" });
    const sig = sign(APP_SECRET, body);
    expect(verifyMetaSignature(APP_SECRET, `${body}x`, sig)).toBe(false);
  });

  it("rejects wrong secret", () => {
    const body = "x";
    expect(verifyMetaSignature(APP_SECRET, body, sign("other", body))).toBe(false);
  });

  it("rejects missing/empty signature", () => {
    expect(verifyMetaSignature(APP_SECRET, "x", null)).toBe(false);
    expect(verifyMetaSignature(APP_SECRET, "x", "")).toBe(false);
    expect(verifyMetaSignature(APP_SECRET, "x", "sha256=")).toBe(false);
  });

  it("rejects when appSecret is empty", () => {
    expect(verifyMetaSignature("", "x", sign("x", "x"))).toBe(false);
  });
});

describe("mapMetaLeadgenToIntake", () => {
  const base: MetaLeadgenResponse = {
    id: "lg_123",
    created_time: "2026-05-26T10:00:00+0000",
    field_data: [
      { name: "full_name", values: ["Marta García"] },
      { name: "email", values: ["marta@example.com"] },
      { name: "phone_number", values: ["+34600111222"] },
      { name: "company_name", values: ["Acme SL"] },
    ],
    ad_id: "ad_1",
    adset_id: "adset_1",
    campaign_id: "camp_1",
    form_id: "form_1",
    platform: "fb",
  };

  it("maps standard English field names", () => {
    const out = mapMetaLeadgenToIntake(base);
    expect(out.name).toBe("Marta García");
    expect(out.email).toBe("marta@example.com");
    expect(out.phone).toBe("+34600111222");
    expect(out.company).toBe("Acme SL");
    expect(out.externalId).toBe("lg_123");
    expect(out.externalSource).toBe("meta_lead_ads");
    expect(out.source).toBe("meta_lead_ads");
  });

  it("propagates ad / adset / campaign into utm", () => {
    const out = mapMetaLeadgenToIntake(base);
    expect(out.utm?.source).toBe("facebook");
    expect(out.utm?.medium).toBe("paid_social");
    expect(out.utm?.campaign).toBe("camp_1");
    expect(out.utm?.content).toBe("ad_1");
    expect(out.utm?.term).toBe("adset_1");
  });

  it("falls back to first_name + last_name when full_name missing", () => {
    const out = mapMetaLeadgenToIntake({
      ...base,
      field_data: [
        { name: "first_name", values: ["Marta"] },
        { name: "last_name", values: ["García"] },
        { name: "email", values: ["m@x.com"] },
      ],
    });
    expect(out.name).toBe("Marta García");
  });

  it("accepts Spanish localized field names", () => {
    const out = mapMetaLeadgenToIntake({
      ...base,
      field_data: [
        { name: "nombre_completo", values: ["Pol G"] },
        { name: "correo_electronico", values: ["pol@x.com"] },
        { name: "telefono", values: ["600"] },
        { name: "empresa", values: ["Doscientos"] },
      ],
    });
    expect(out.name).toBe("Pol G");
    expect(out.email).toBe("pol@x.com");
    expect(out.phone).toBe("600");
    expect(out.company).toBe("Doscientos");
  });

  it("defaults to placeholder when no name field present", () => {
    const out = mapMetaLeadgenToIntake({
      ...base,
      field_data: [{ name: "email", values: ["x@y.com"] }],
    });
    expect(out.name).toBe("Lead sin nombre");
  });

  it("stores raw payload for audit", () => {
    const out = mapMetaLeadgenToIntake(base, { pageId: "page_99", createdTime: 1700000000 });
    expect(out.rawPayload).toMatchObject({
      id: "lg_123",
      webhookCtx: { pageId: "page_99", createdTime: 1700000000 },
    });
  });

  it("extracts ¿…? form questions as notes", () => {
    const out = mapMetaLeadgenToIntake({
      ...base,
      field_data: [
        { name: "full_name", values: ["Test User"] },
        { name: "¿Tamaño de empresa?", values: ["10-50 empleados"] },
        { name: "¿Qué solución necesitas desarrollar?", values: ["Software a Medida"] },
        { name: "¿Cuál es tu presupuesto estimado?", values: ["Más de 10.000€"] },
      ],
    });
    expect(out.notes).toContain("Tamaño de empresa: 10-50 empleados");
    expect(out.notes).toContain("Qué solución necesitas desarrollar: Software a Medida");
    expect(out.notes).toContain("Cuál es tu presupuesto estimado: Más de 10.000€");
  });

  it("parses budget into estimatedValue (lower bound of range)", () => {
    const cases: Array<[string, number]> = [
      ["Más de 10.000€", 10000],
      ["Menos de 5.000€", 5000],
      ["5.000€ - 10.000€", 5000],
    ];
    for (const [text, expected] of cases) {
      const out = mapMetaLeadgenToIntake({
        ...base,
        field_data: [
          { name: "full_name", values: ["Test"] },
          { name: "¿Cuál es tu presupuesto estimado?", values: [text] },
        ],
      });
      expect(out.estimatedValue).toBe(expected);
    }
  });

  it("returns null estimatedValue when no budget field present", () => {
    const out = mapMetaLeadgenToIntake(base);
    expect(out.estimatedValue).toBeNull();
  });

  it("returns null notes when no ¿…? fields present", () => {
    const out = mapMetaLeadgenToIntake(base);
    expect(out.notes).toBeNull();
  });
});
