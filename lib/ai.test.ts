import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { generateText, createVertex } = vi.hoisted(() => ({
  generateText: vi.fn(),
  createVertex: vi.fn(() => () => ({ modelId: "test-model" })),
}));

vi.mock("ai", () => ({
  generateText,
  Output: { object: vi.fn(() => ({ name: "object" })) },
}));
vi.mock("@ai-sdk/google-vertex", () => ({
  createVertex,
}));
vi.mock("./env", () => ({ isAIEnabled: () => true }));
vi.mock("./logger", () => ({ scopedLogger: () => ({ info: vi.fn() }) }));

import { runAIChat, runAIObject } from "./ai";

const schema = z.object({ title: z.string() });
const input = {
  model: "gemini-3.1-flash-lite",
  system: "Devuelve un objeto JSON.",
  user: "Prepara un borrador.",
  schema,
};

describe("runAIObject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AI_PROVIDER", "vertex");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("retries once when the provider returns malformed JSON", async () => {
    generateText
      .mockRejectedValueOnce(new SyntaxError("JSON.parse: unexpected character at line 1 column 1"))
      .mockResolvedValueOnce({ output: { title: "Borrador válido" }, usage: undefined });

    await expect(runAIObject(input)).resolves.toEqual({ title: "Borrador válido" });
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(generateText.mock.calls[1]?.[0].system).toContain(
      "exclusivamente con un objeto JSON válido",
    );
  });

  it("retries when the provider finishes without structured output", async () => {
    const noOutputError = new Error("No output generated.");
    noOutputError.name = "AI_NoOutputGeneratedError";
    generateText
      .mockRejectedValueOnce(noOutputError)
      .mockResolvedValueOnce({ output: { title: "Borrador válido" }, usage: undefined });

    await expect(runAIObject(input)).resolves.toEqual({ title: "Borrador válido" });
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("hides JSON parsing details when the retry also fails", async () => {
    generateText.mockRejectedValue(
      new SyntaxError("JSON.parse: unexpected character at line 1 column 1"),
    );

    await expect(runAIObject(input)).rejects.toThrow(
      "La IA devolvió un resultado con un formato no válido. Inténtalo de nuevo.",
    );
  });

  it("uses Gemini 3 thinking settings instead of legacy sampling options", async () => {
    generateText.mockResolvedValue({ text: "Resumen válido", usage: undefined });

    await expect(
      runAIChat({
        model: "gemini-3.1-flash-lite",
        system: "Resume.",
        user: "Notas.",
        temperature: 0,
        maxOutputTokens: 100,
      }),
    ).resolves.toBe("Resumen válido");

    const options = generateText.mock.calls[0]?.[0];
    expect(options.temperature).toBeUndefined();
    expect(options.providerOptions).toEqual({
      vertex: { thinkingConfig: { thinkingLevel: "minimal" } },
    });
  });

  it("uses the supported EU multi-region endpoint for Gemini 3.1 Flash-Lite", async () => {
    vi.stubEnv("GOOGLE_CLOUD_LOCATION", "us-central1");
    generateText.mockResolvedValue({ text: "Respuesta válida", usage: undefined });

    await expect(
      runAIChat({ model: input.model, system: "Resume.", user: "Notas." }),
    ).resolves.toBe("Respuesta válida");

    expect(createVertex).toHaveBeenCalledWith(expect.objectContaining({ location: "eu" }));
  });

  it("returns a clear message when Vertex cannot find the publisher model", async () => {
    generateText.mockRejectedValue(
      new Error(
        "Publisher model projects/example/locations/us-central1/publishers/google/models/gemini-3.1-flash-lite was not found or your project does not have access to it.",
      ),
    );

    await expect(runAIObject(input)).rejects.toThrow(
      "Vertex AI no encuentra el modelo en la región configurada o el proyecto no tiene acceso.",
    );
  });
});
