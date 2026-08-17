import { z } from "zod";

export const SCOPE_MODULE_LIMITS = {
  maxCount: 12,
  maxTitleLength: 160,
  maxDescriptionLength: 2_000,
  maxBulletCount: 24,
  maxBulletLength: 500,
  maxNotesLength: 2_000,
} as const;

export const SCOPE_MODULE_DURATION_WEEKS = [1, 2, 3, 4, 5, 6] as const;
export type ScopeModuleDurationWeeks = (typeof SCOPE_MODULE_DURATION_WEEKS)[number];

export function scopeModuleDurationLabel(weeks: number): string {
  return `${weeks} ${weeks === 1 ? "semana" : "semanas"}`;
}

const scopeBullet = z.string().trim().min(1).max(SCOPE_MODULE_LIMITS.maxBulletLength);
const customDuration = z
  .string()
  .trim()
  .regex(
    /^\d+\s+(días?|semanas?|mes|meses)$/,
    "Usa un número y una unidad: días, semanas o meses",
  )
  .max(32);

export const scopeModuleInput = z
  .object({
    id: z.string().min(1).max(64),
    title: z
      .string()
      .trim()
      .min(1, "El nombre del módulo es obligatorio")
      .max(SCOPE_MODULE_LIMITS.maxTitleLength),
    description: z.string().max(SCOPE_MODULE_LIMITS.maxDescriptionLength).nullable().optional(),
    included: z.array(scopeBullet).max(SCOPE_MODULE_LIMITS.maxBulletCount),
    excluded: z.array(scopeBullet).max(SCOPE_MODULE_LIMITS.maxBulletCount),
    notes: z.string().max(SCOPE_MODULE_LIMITS.maxNotesLength).nullable().optional(),
    duration_mode: z.enum(["weeks", "custom"]).optional(),
    duration_weeks: z.number().int().min(1).max(6).optional(),
    duration_custom: customDuration.optional(),
  })
  .superRefine((module, ctx) => {
    if (module.duration_mode === "weeks" && !module.duration_weeks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["duration_weeks"],
        message: "Selecciona el plazo estimado del módulo",
      });
    }
    if (module.duration_mode === "custom" && !module.duration_custom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["duration_custom"],
        message: "Indica el plazo personalizado del módulo",
      });
    }
  });

export const scopeModulesInput = z.array(scopeModuleInput).max(SCOPE_MODULE_LIMITS.maxCount);
export type ScopeModule = z.infer<typeof scopeModuleInput>;

export function scopeModuleDurationText(
  module: Pick<ScopeModule, "duration_mode" | "duration_weeks" | "duration_custom">,
): string | null {
  if (module.duration_mode === "custom") return module.duration_custom ?? null;
  return module.duration_weeks ? scopeModuleDurationLabel(module.duration_weeks) : null;
}

export const PAYMENT_SCHEDULES = [
  "upfront",
  "half_half",
  "30_40_30",
  "per_module_upfront",
  "custom",
] as const;
export const paymentScheduleInput = z.enum(PAYMENT_SCHEDULES);
export type PaymentSchedule = z.infer<typeof paymentScheduleInput>;

export const PAYMENT_SCHEDULE_LABELS: Record<PaymentSchedule, string> = {
  upfront: "100 % al aceptar",
  half_half: "50 % al aceptar · 50 % a la entrega",
  "30_40_30": "30 % al aceptar · 40 % durante el proyecto · 30 % a la entrega",
  per_module_upfront: "Pago adelantado por módulo",
  custom: "Personalizado",
};

export const PAYMENT_SCHEDULE_TEMPLATES: Record<Exclude<PaymentSchedule, "custom">, string> = {
  upfront: "El 100 % del importe se abonará a la aceptación de la propuesta.",
  half_half:
    "El 50 % del importe se abonará a la aceptación de la propuesta y el 50 % restante a la entrega.",
  "30_40_30":
    "El 30 % del importe se abonará a la aceptación, el 40 % al validar el avance acordado y el 30 % restante a la entrega.",
  per_module_upfront:
    "El importe de cada módulo se abonará por adelantado antes de iniciar su ejecución.",
};

export const DEFAULT_CHANGE_MANAGEMENT_TERMS =
  "Las solicitudes que excedan el alcance descrito se analizarán y, si procede, se presentarán como una ampliación de alcance y presupuesto antes de ejecutarse.";

/** `null` means the bespoke terms should be handled outside the automatic payment flow. */
export function paymentInitialPercentage(schedule: PaymentSchedule): number | null {
  return {
    upfront: 100,
    half_half: 50,
    "30_40_30": 30,
    per_module_upfront: null,
    custom: null,
  }[schedule];
}

export function createEmptyScopeModule(): ScopeModule {
  return {
    id: crypto.randomUUID(),
    title: "",
    description: "",
    included: [],
    excluded: [],
    notes: "",
    duration_mode: "weeks",
    duration_weeks: 1,
  };
}

/** Safely reads legacy or malformed JSONB without breaking public proposal views. */
export function parseScopeModules(value: unknown): ScopeModule[] {
  const parsed = scopeModulesInput.safeParse(value);
  return parsed.success ? parsed.data : [];
}
