"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormFeedback } from "@/components/ui/form-feedback";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Loader2, Play } from "lucide-react";
import {
  type TestResult,
  testAI,
  testResendEmail,
  testSupabaseConnection,
  testTelegramBot,
  testTelegramLeadMessage,
} from "./actions";

export type DiagnosticsConfig = {
  telegramBot: boolean;
  telegramChat: boolean;
  ai: boolean;
};

type Test = {
  title: string;
  description: string;
  run: () => Promise<TestResult>;
  disabled?: boolean;
  disabledHint?: string;
};

function TestRow({ test }: { test: Test }) {
  const fb = useFormFeedback({ successResetMs: 0 });
  const { state } = fb;

  async function onClick() {
    fb.setPending();
    try {
      const r = await test.run();
      if (r.ok) fb.setSuccess(r.detail);
      else fb.setError(r.error);
    } catch (e) {
      fb.setError(e instanceof Error ? e.message : "Error inesperado");
    }
  }

  return (
    <div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{test.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {test.disabled ? (test.disabledHint ?? "No configurado") : test.description}
        </p>
        {state.status === "success" || state.status === "error" ? (
          <p
            className={cn(
              "mt-1.5 inline-flex items-start gap-1.5 text-xs",
              state.status === "success" ? "text-success" : "text-destructive",
            )}
          >
            {state.status === "success" ? (
              <CheckCircle2 className="mt-px size-3.5 shrink-0" aria-hidden />
            ) : (
              <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
            )}
            <span className="break-words">
              {state.status === "success" ? state.message : state.message}
            </span>
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onClick}
        disabled={test.disabled || state.status === "pending"}
        aria-busy={state.status === "pending" || undefined}
        className="shrink-0"
      >
        {state.status === "pending" ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Play className="size-3.5" aria-hidden />
        )}
        {state.status === "pending" ? "Probando…" : "Probar"}
      </Button>
    </div>
  );
}

export function DiagnosticsPanel({ config }: { config: DiagnosticsConfig }) {
  const tests: Test[] = [
    {
      title: "Lead → Telegram (envío directo)",
      description: "Envía un lead de ejemplo directamente al chat vía API de Telegram.",
      run: testTelegramLeadMessage,
      disabled: !config.telegramBot || !config.telegramChat,
      disabledHint: !config.telegramBot ? "Falta TELEGRAM_BOT_TOKEN" : "Falta TELEGRAM_CHAT_ID",
    },
    {
      title: "Bot de Telegram (token)",
      description: "Verifica que el token del bot es válido (getMe).",
      run: testTelegramBot,
      disabled: !config.telegramBot,
      disabledHint: "Falta TELEGRAM_BOT_TOKEN",
    },
    {
      title: "Email (Resend)",
      description: "Envía un email de prueba a tu propia dirección.",
      run: testResendEmail,
    },
    {
      title: "Conexión Supabase",
      description: "Ejecuta una consulta ligera contra la base de datos.",
      run: testSupabaseConnection,
    },
    {
      title: "IA (Gemini / OpenAI)",
      description: "Envía un prompt mínimo para comprobar la respuesta.",
      run: testAI,
      disabled: !config.ai,
      disabledHint: "IA no configurada",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pruebas de sistemas</CardTitle>
        <CardDescription>
          Cada prueba usa datos de ejemplo y no afecta a datos reales.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y divide-border pt-0">
        {tests.map((test) => (
          <TestRow key={test.title} test={test} />
        ))}
      </CardContent>
    </Card>
  );
}
