import { serverEnv } from "@/lib/env";
import { scopedLogger } from "@/lib/logger";

/**
 * Thin, reusable Telegram Bot API client.
 *
 * Single source of truth for every outbound Telegram call (new-lead
 * notifications, inline-button callbacks, diagnostics). Returns a
 * discriminated result instead of throwing so callers can surface a clean
 * error, and never logs the bot token.
 */

const log = scopedLogger("telegram");

const API_BASE = "https://api.telegram.org";
const DEFAULT_TIMEOUT_MS = 5000;

export type TelegramResult<T = unknown> = { ok: true; result: T } | { ok: false; error: string };

export type TelegramBotInfo = { id: number; username?: string; first_name?: string };

export type InlineKeyboard = { text: string; callback_data: string }[][];

/** Bot token if configured, else null. */
export function telegramToken(): string | null {
  return serverEnv().TELEGRAM_BOT_TOKEN?.trim() || null;
}

/** Default chat/group id for outbound messages if configured, else null. */
export function telegramChatId(): string | null {
  return serverEnv().TELEGRAM_CHAT_ID?.trim() || null;
}

/**
 * Low-level Bot API call. Never throws — network/API errors are returned as
 * `{ ok: false, error }`. The token is accepted via `opts.token` (already
 * resolved by the caller) or read from the environment.
 */
export async function telegramRequest<T = unknown>(
  method: string,
  body: Record<string, unknown> = {},
  opts: { token?: string; timeoutMs?: number } = {},
): Promise<TelegramResult<T>> {
  const token = opts.token ?? telegramToken();
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN no configurado" };

  try {
    const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => null)) as {
      ok?: boolean;
      result?: T;
      description?: string;
    } | null;

    if (!res.ok || !json?.ok) {
      const desc = json?.description ?? `HTTP ${res.status}`;
      log.warn({ method, status: res.status, desc }, "telegram request failed");
      return { ok: false, error: desc };
    }
    return { ok: true, result: json.result as T };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network error";
    log.error({ err: e, method }, "telegram request threw");
    return { ok: false, error: msg };
  }
}

/** Verifies the bot token by calling getMe. */
export function telegramGetMe(opts?: { token?: string }): Promise<TelegramResult<TelegramBotInfo>> {
  return telegramRequest<TelegramBotInfo>("getMe", {}, opts);
}

/**
 * Sends a text message. Defaults to the configured chat id and can attach an
 * inline keyboard whose `callback_data` is handled by the Telegram webhook.
 */
export function telegramSendMessage(input: {
  text: string;
  chatId?: string;
  parseMode?: "Markdown" | "MarkdownV2" | "HTML";
  inlineKeyboard?: InlineKeyboard;
  token?: string;
}): Promise<TelegramResult> {
  const chatId = input.chatId ?? telegramChatId();
  if (!chatId) return Promise.resolve({ ok: false, error: "TELEGRAM_CHAT_ID no configurado" });

  return telegramRequest(
    "sendMessage",
    {
      chat_id: chatId,
      text: input.text,
      ...(input.parseMode ? { parse_mode: input.parseMode } : {}),
      ...(input.inlineKeyboard ? { reply_markup: { inline_keyboard: input.inlineKeyboard } } : {}),
    },
    { token: input.token },
  );
}
