/**
 * Cliente OpenAI con feature-gate.
 * Nunca instanciar directamente — usar getOpenAI() y comprobar isAIEnabled() antes.
 */
import OpenAI from "openai";
import { isAIEnabled } from "./env";

/**
 * Modelos recomendados para cada tarea.
 * Usamos gpt-4o-mini por defecto para ahorrar tokens según decisión del equipo.
 */
export const AI_MODELS = {
  default: "gpt-4o-mini",
  summarizer: "gpt-4o-mini",
  drafter: "gpt-4o-mini", // Cambiado de gpt-4o a gpt-4o-mini
} as const;

let _client: OpenAI | null = null;

/**
 * Devuelve el cliente OpenAI si la API key está configurada.
 * Lanza un error claro si se llama sin key (el caller debe comprobar isAIEnabled() antes).
 */
export function getOpenAI(): OpenAI {
  if (!isAIEnabled()) {
    throw new Error("OpenAI no está configurado. Añade OPENAI_API_KEY a las variables de entorno.");
  }
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

export { isAIEnabled };
