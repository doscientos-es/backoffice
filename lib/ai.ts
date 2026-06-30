/**
 * Cliente AI con feature-gate.
 * Soporta Google Gemini (via endpoint OpenAI-compatible) y OpenAI como fallback.
 * Nunca instanciar directamente — usar getAIClient() y comprobar isAIEnabled() antes.
 *
 * Prioridad: GEMINI_API_KEY > OPENAI_API_KEY
 */
import OpenAI from "openai";
import { isAIEnabled } from "./env";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

/**
 * Modelos por tarea.
 * Gemini 2.5 Flash-Lite: mejor relación precio/calidad para backoffice (junio 2026).
 */
export const AI_MODELS = {
  default: "gemini-2.5-flash-lite",
  summarizer: "gemini-2.5-flash-lite",
  drafter: "gemini-2.5-flash-lite",
} as const;

let _client: OpenAI | null = null;

/**
 * Devuelve el cliente AI configurado (Gemini o OpenAI).
 * Lanza un error claro si se llama sin ninguna key.
 */
export function getAIClient(): OpenAI {
  if (!isAIEnabled()) {
    throw new Error(
      "IA no configurada. Añade GEMINI_API_KEY (o OPENAI_API_KEY) a las variables de entorno.",
    );
  }
  if (!_client) {
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (geminiKey) {
      _client = new OpenAI({ apiKey: geminiKey, baseURL: GEMINI_BASE_URL });
    } else {
      _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
  }
  return _client;
}

/** @deprecated Usa getAIClient(). Mantenido por compatibilidad. */
export const getOpenAI = getAIClient;

/** Timeout máximo por llamada — spec sec. 22.3: 30s y devolver error si falla. */
export const AI_TIMEOUT_MS = 30_000;

export type RunAIChatInput = {
  /** Modelo OpenAI (usar AI_MODELS.*). */
  model: string;
  /** System prompt — define rol y formato de respuesta. */
  system: string;
  /** User prompt — datos del caso concreto. */
  user: string;
  /** Si true, fuerza response_format JSON (el modelo NUNCA devuelve markdown). */
  json?: boolean;
  /** Temperatura del muestreo. Default 0.3 (preferimos consistencia). */
  temperature?: number;
};

/**
 * Ejecuta una chat completion con timeout de 30s y devuelve el contenido crudo.
 * El caller decide si parsea JSON o lo usa tal cual.
 *
 * Lanza Error con mensaje legible si:
 *  - la IA no está configurada
 *  - se supera el timeout
 *  - el modelo no devuelve contenido
 */
export async function runAIChat(input: RunAIChatInput): Promise<string> {
  const client = getAIClient();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const completion = await client.chat.completions.create(
      {
        model: input.model,
        temperature: input.temperature ?? 0.3,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
        ...(input.json ? { response_format: { type: "json_object" } as const } : {}),
      },
      { signal: controller.signal },
    );
    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) throw new Error("La IA no devolvió contenido.");
    return content;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("La IA tardó demasiado en responder (timeout 30s).");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Igual que runAIChat pero parsea la respuesta como JSON. */
export async function runAIJson<T>(input: Omit<RunAIChatInput, "json">): Promise<T> {
  const raw = await runAIChat({ ...input, json: true });
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("La IA devolvió un JSON no válido.");
  }
}

export { isAIEnabled };
