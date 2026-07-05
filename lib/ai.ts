import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createVertex } from "@ai-sdk/google-vertex";
import { createOpenAI } from "@ai-sdk/openai";
/**
 * Cliente AI - capa de abstraccion sobre Vercel AI SDK.
 *
 * Proveedor controlado por AI_PROVIDER env var:
 *  - "vertex": Google Vertex AI. Autenticación en dos modos:
 *      · Local  → ADC (`gcloud auth application-default login`), sin env de credenciales.
 *      · Vercel/prod → Service Account vía GOOGLE_SA_CLIENT_EMAIL + GOOGLE_SA_PRIVATE_KEY_BASE64
 *        (no hay ADC ni metadata server en serverless, hay que pasar las credenciales).
 *  - "gemini": Google AI Studio (requiere GEMINI_API_KEY)
 *  - "openai": OpenAI (requiere OPENAI_API_KEY)
 *  - "deepseek": DeepSeek (requiere DEEPSEEK_API_KEY)
 */
import { type LanguageModel, generateText } from "ai";
import { isAIEnabled } from "./env";

/**
 * Modelos por tarea.
 * Usamos nombres genéricos que se mapean al proveedor elegido.
 */
export const AI_MODELS = {
  default: "gemini-2.5-flash",
  summarizer: "gemini-2.5-flash",
  drafter: "gemini-2.5-flash",
} as const;

/** Timeout máximo por llamada — 30s. */
export const AI_TIMEOUT_MS = 30_000;

/**
 * Opciones de autenticación para Vertex.
 * Si la Service Account está en el entorno (Vercel/producción) devuelve sus
 * credenciales explícitas; si no (local), devuelve undefined para que el SDK
 * use ADC automáticamente.
 */
function vertexAuthOptions():
  | { credentials: { client_email: string; private_key: string } }
  | undefined {
  const clientEmail = process.env.GOOGLE_SA_CLIENT_EMAIL?.trim();
  const keyB64 = process.env.GOOGLE_SA_PRIVATE_KEY_BASE64?.trim();
  if (!clientEmail || !keyB64) return undefined;
  const privateKey = Buffer.from(keyB64, "base64").toString("utf8").trim();
  return { credentials: { client_email: clientEmail, private_key: privateKey } };
}

/**
 * Resuelve el modelo de IA según el proveedor configurado en AI_PROVIDER.
 */
function resolveModel(modelName: string): LanguageModel {
  const provider = process.env.AI_PROVIDER?.trim();

  if (provider === "vertex") {
    const auth = vertexAuthOptions();
    const vertex = createVertex({
      project: process.env.GOOGLE_CLOUD_PROJECT_ID,
      location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
      ...(auth ? { googleAuthOptions: auth } : {}),
    });
    return vertex(modelName);
  }

  if (provider === "gemini") {
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
    return google(modelName);
  }

  if (provider === "openai") {
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    return openai(modelName);
  }

  if (provider === "deepseek") {
    const deepseek = createOpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey: process.env.DEEPSEEK_API_KEY,
    });
    return deepseek(modelName);
  }

  throw new Error(`Proveedor de IA '${provider}' no soportado o no configurado.`);
}

export type RunAIChatInput = {
  /** Nombre del modelo (usar AI_MODELS.*). */
  model: string;
  /** System prompt — define rol y formato de respuesta. */
  system: string;
  /** User prompt — datos del caso concreto. */
  user: string;
  /** Si true, intenta forzar formato JSON. */
  json?: boolean;
  /** Temperatura del muestreo. Default 0.3. */
  temperature?: number;
};

/**
 * Ejecuta una chat completion con timeout de 30s y devuelve el texto.
 */
export async function runAIChat(input: RunAIChatInput): Promise<string> {
  if (!isAIEnabled()) {
    throw new Error("IA no configurada. Verifica AI_PROVIDER y credenciales en .env.local");
  }

  const model = resolveModel(input.model);

  try {
    const { text } = await generateText({
      model,
      system: input.system,
      prompt: input.user,
      temperature: input.temperature ?? 0.3,
      abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
      ...(input.json ? { responseFormat: { type: "json" } } : {}),
    });

    if (!text) throw new Error("La IA no devolvió contenido.");
    return text;
  } catch (err) {
    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
      throw new Error("La IA tardó demasiado en responder (timeout 30s).");
    }
    throw err;
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
