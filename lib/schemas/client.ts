import { z } from "zod";
import { optionalEmail, optionalText, requiredText } from "./common";

/**
 * Zod schemas for the `clients` domain.
 *
 * Re-used by server actions and API routes. Keep the shape aligned with the
 * `clients` table in supabase/migrations; fields here are the user-supplied
 * inputs, NOT the full DB row.
 */

export const CreateClientInput = z.object({
  name: requiredText(160, "El nombre es obligatorio"),
  nif: optionalText(20),
  email: optionalEmail,
  phone: optionalText(40),
  billing_address: optionalText(400),
  contact_person: optionalText(160),
  notes: optionalText(4000),
});

export type CreateClientInputType = z.infer<typeof CreateClientInput>;

export const UpdateClientInput = CreateClientInput.extend({
  id: z.string().uuid(),
});

export type UpdateClientInputType = z.infer<typeof UpdateClientInput>;
