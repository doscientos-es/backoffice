import { serverEnv } from "@/lib/env";
import pino, { type Logger } from "pino";

let cached: Logger | null = null;

/**
 * Structured logger to stdout (pino).
 * In dev: pretty-printed; in prod: JSON for log aggregators.
 */
export function logger(): Logger {
  if (cached) return cached;
  const env = serverEnv();
  cached = pino({
    level: env.LOG_LEVEL,
    base: { app: "backoffice-doscientos" },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "*.SUPABASE_SERVICE_ROLE_KEY",
        "*.RESEND_API_KEY",
        "*.OPENAI_API_KEY",
        "*.VERIFACTU_CERT_PASSWORD",
        "*.VERIFACTU_CERT_P12_BASE64",
      ],
      remove: true,
    },
  });
  return cached;
}

/** Returns a child logger scoped to a feature / module name. */
export function scopedLogger(scope: string): Logger {
  return logger().child({ scope });
}
