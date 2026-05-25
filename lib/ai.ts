/**
 * Cliente OpenAI con feature-gate.
 * Nunca instanciar directamente — usar getOpenAI() y comprobar isAIEnabled() antes.
 */
import OpenAI from "openai";
import { isAIEnabled } from "./env";

let _client: OpenAI | null = null;

/**
 * Devuelve el cliente OpenAI si la API key está configurada.
 * Lanza un error claro si se llama sin key (el caller debe comprobar isAIEnabled() antes).
 */
export function getOpenAI(): OpenAI {
  if (!isAIEnabled()) {
    throw new Error(
      "OpenAI no está configurado. Añade OPENAI_API_KEY a las variables de entorno.",
    );
  }
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

export { isAIEnabled };
