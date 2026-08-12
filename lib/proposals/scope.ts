import { z } from "zod";

export const SCOPE_MODULE_LIMITS = {
  maxCount: 12,
  maxTitleLength: 160,
  maxDescriptionLength: 2_000,
  maxBulletCount: 24,
  maxBulletLength: 500,
  maxNotesLength: 2_000,
} as const;

const scopeBullet = z.string().trim().min(1).max(SCOPE_MODULE_LIMITS.maxBulletLength);

export const scopeModuleInput = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().min(1, "El nombre del módulo es obligatorio").max(SCOPE_MODULE_LIMITS.maxTitleLength),
  description: z.string().max(SCOPE_MODULE_LIMITS.maxDescriptionLength).nullable().optional(),
  included: z.array(scopeBullet).max(SCOPE_MODULE_LIMITS.maxBulletCount),
  excluded: z.array(scopeBullet).max(SCOPE_MODULE_LIMITS.maxBulletCount),
  notes: z.string().max(SCOPE_MODULE_LIMITS.maxNotesLength).nullable().optional(),
});

export const scopeModulesInput = z.array(scopeModuleInput).max(SCOPE_MODULE_LIMITS.maxCount);
export type ScopeModule = z.infer<typeof scopeModuleInput>;

export const PAYMENT_SCHEDULES = ["upfront", "half_half", "30_40_30", "custom"] as const;
export const paymentScheduleInput = z.enum(PAYMENT_SCHEDULES);
export type PaymentSchedule = z.infer<typeof paymentScheduleInput>;

export const PAYMENT_SCHEDULE_LABELS: Record<PaymentSchedule, string> = {
  upfront: "100 % al aceptar",
  half_half: "50 % al aceptar · 50 % a la entrega",
  "30_40_30": "30 % al aceptar · 40 % durante el proyecto · 30 % a la entrega",
  custom: "Personalizado",
};

export const PAYMENT_SCHEDULE_TEMPLATES: Record<Exclude<PaymentSchedule, "custom">, string> = {
  upfront: "El 100 % del importe se abonará a la aceptación de la propuesta.",
  half_half: "El 50 % del importe se abonará a la aceptación de la propuesta y el 50 % restante a la entrega.",
  "30_40_30": "El 30 % del importe se abonará a la aceptación, el 40 % al validar el avance acordado y el 30 % restante a la entrega.",
};

export const DEFAULT_CHANGE_MANAGEMENT_TERMS =
  "Las solicitudes que excedan el alcance descrito se analizarán y, si procede, se presentarán como una ampliación de alcance y presupuesto antes de ejecutarse.";

export function createEmptyScopeModule(): ScopeModule {
  return {
    id: crypto.randomUUID(),
    title: "",
    description: "",
    included: [],
    excluded: [],
    notes: "",
  };
}

/** Safely reads legacy or malformed JSONB without breaking public proposal views. */
export function parseScopeModules(value: unknown): ScopeModule[] {
  const parsed = scopeModulesInput.safeParse(value);
  return parsed.success ? parsed.data : [];
}