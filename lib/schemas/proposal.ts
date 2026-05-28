import { KEY_POINTS_LIMITS } from "@/lib/proposals/key-points";
import { z } from "zod";
import { emptyToUndef, lineItemInput, uuidIdInput } from "./common";

/**
 * Shape of a single problem/solution narrative bullet. The id is generated
 * client-side and persisted as-is so the deck/portal can use it as a React
 * key without re-deriving it on every render.
 */
export const keyPointInput = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().min(1, "Título obligatorio").max(KEY_POINTS_LIMITS.maxTitleLength),
  description: z
    .string()
    .max(KEY_POINTS_LIMITS.maxDescriptionLength)
    .nullable()
    .optional(),
});
export type KeyPointInputType = z.infer<typeof keyPointInput>;

/** Reusable, nullable list of key points capped at the domain limit. */
const keyPointListField = z.array(keyPointInput).max(KEY_POINTS_LIMITS.maxCount).nullable().optional();

/**
 * Zod schemas for the `proposals` domain.
 *
 * Covers proposal CRUD (used by both the FormData and JSON entry points in
 * `app/(app)/proposals/actions.ts`), proposal specs (`spec-actions.ts`) and
 * the public portal token transitions (`app/p/proposal/[token]/actions.ts`).
 */

// ---------------- Proposals ----------------

export const CreateProposalInput = z.object({
  client_id: z.string().uuid("Cliente inválido"),
  project_id: z.string().uuid().optional().or(emptyToUndef),
  title: z.string().min(1, "Título obligatorio").max(200),
  valid_until: z.string().optional().or(emptyToUndef),
  notes: z.string().max(4000).optional(),
  items: z.array(lineItemInput).min(1, "Añade al menos una línea"),
});
export type CreateProposalInputType = z.infer<typeof CreateProposalInput>;

/**
 * Patch payload for the inline editor + autosave. All fields optional except
 * `id`; nullable string fields collapse "" → null so the editor can clear
 * them. When `items` is present the entire line set is replaced atomically.
 */
export const UpdateProposalInput = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  valid_until: z
    .string()
    .optional()
    .or(z.literal("").transform(() => null))
    .nullable(),
  notes: z
    .string()
    .max(4000)
    .optional()
    .or(z.literal("").transform(() => null))
    .nullable(),
  context_markdown: z
    .string()
    .max(20_000)
    .optional()
    .or(z.literal("").transform(() => null))
    .nullable(),
  problems: keyPointListField,
  solutions: keyPointListField,
  terms: z
    .string()
    .max(20_000)
    .optional()
    .or(z.literal("").transform(() => null))
    .nullable(),
  items: z.array(lineItemInput).min(1).optional(),
});
export type UpdateProposalInputType = z.infer<typeof UpdateProposalInput>;

export const SendProposalPreviewInput = z.object({
  id: z.string().uuid(),
  to: z.string().email().optional(),
  message: z.string().max(1000).optional(),
});
export type SendProposalPreviewInputType = z.infer<typeof SendProposalPreviewInput>;

// ---------------- Proposal specs ----------------

export const CreateProposalSpecInput = z.object({
  proposal_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  body_markdown: z.string().min(1).max(60_000),
  is_client_visible: z.boolean().default(false),
});
export type CreateProposalSpecInputType = z.infer<typeof CreateProposalSpecInput>;

export const UpdateProposalSpecInput = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  body_markdown: z.string().min(1).max(60_000).optional(),
});
export type UpdateProposalSpecInputType = z.infer<typeof UpdateProposalSpecInput>;

export const ToggleProposalSpecVisibilityInput = z.object({
  id: z.string().uuid(),
  is_client_visible: z.boolean(),
});
export type ToggleProposalSpecVisibilityInputType = z.infer<
  typeof ToggleProposalSpecVisibilityInput
>;

export const ProposalSpecIdInput = uuidIdInput;

// ---------------- Public portal (token-scoped) ----------------

/**
 * Hex token used in `/p/proposal/[token]`. Length matches the random_bytes
 * size used when generating portal_token on the server.
 */
export const ProposalPortalToken = z
  .string()
  .min(32)
  .max(128)
  .regex(/^[a-f0-9]+$/i);

export const ProposalRejectionReason = z.string().max(500).optional();
