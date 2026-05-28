import { z } from "zod";
import { uuidIdInput } from "./common";

/**
 * Zod schemas for the `internal_documents` domain.
 *
 * Used by both the soft-delete server action and the `/api/internal-docs/upload`
 * route. The enums are exposed as plain arrays for the upload route, which
 * needs to do a manual `includes()` check on raw FormData values.
 */

export const INTERNAL_DOC_CATEGORIES = [
  "legal",
  "hr",
  "finance",
  "templates",
  "policies",
  "meetings",
  "other",
] as const;
export type InternalDocCategory = (typeof INTERNAL_DOC_CATEGORIES)[number];

export const INTERNAL_DOC_VISIBILITIES = ["all_team", "admins_only"] as const;
export type InternalDocVisibility = (typeof INTERNAL_DOC_VISIBILITIES)[number];

export const InternalDocCategorySchema = z.enum(INTERNAL_DOC_CATEGORIES);
export const InternalDocVisibilitySchema = z.enum(INTERNAL_DOC_VISIBILITIES);

export const InternalDocIdInput = uuidIdInput;

/** Max upload size enforced by the upload route (50 MB). */
export const INTERNAL_DOC_MAX_SIZE_BYTES = 50 * 1024 * 1024;
