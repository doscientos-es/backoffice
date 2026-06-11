import { z } from "zod";

/**
 * New manual work-log entry. `member_id` is never accepted from the client:
 * the action stamps it from the authenticated user. `hours` is decimal
 * (0.25 = 15 min) and capped at a single day.
 */
export const AddWorkLogInput = z.object({
  project_id: z.string().uuid(),
  work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida"),
  hours: z.coerce.number().positive("Horas > 0").max(24, "Máximo 24h por día"),
  note: z.string().max(500).optional(),
});
export type AddWorkLogInputType = z.infer<typeof AddWorkLogInput>;

/**
 * Soft-delete payload. `project_id` travels alongside `id` so the action can
 * revalidate the owning project page without an extra read.
 */
export const DeleteWorkLogInput = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
});
export type DeleteWorkLogInputType = z.infer<typeof DeleteWorkLogInput>;
