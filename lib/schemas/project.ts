import { z } from "zod";
import { parseGithubRepoUrl } from "../integrations/github-sync";
import { emptyToUndef, optionalText, requiredText } from "./common";

/**
 * Zod schemas for the `projects` domain.
 */

export const ProjectStatus = z.enum(["planning", "active", "on_hold", "done", "cancelled"]);
export type ProjectStatusType = z.infer<typeof ProjectStatus>;

export const GithubSyncMode = z.enum(["none", "one_way", "bidirectional", "link_only"]);
export type GithubSyncModeType = z.infer<typeof GithubSyncMode>;

const ProjectBase = z.object({
  client_id: z.string().uuid("Cliente inválido"),
  name: requiredText(160, "El nombre es obligatorio"),
  description: optionalText(4000),
  status: ProjectStatus.default("planning"),

  // --- GitHub integration ---
  github_sync_mode: GithubSyncMode.default("none"),
  github_auto_sync: z.coerce.boolean().default(true),
  github_repo: z.string().url("URL inválida").optional().or(emptyToUndef),
  github_installation_id: z.union([z.coerce.number().int().positive(), emptyToUndef]).optional(),
  github_repo_id: z.union([z.coerce.number().int().positive(), emptyToUndef]).optional(),
  github_last_sync: z.string().optional().or(emptyToUndef),

  // --- Date range ---
  starts_at: z.string().optional().or(emptyToUndef),
  ends_at: z.string().optional().or(emptyToUndef),
});

const projectRefinement = (d: z.infer<typeof ProjectBase>, ctx: z.RefinementCtx) => {
  if (d.github_sync_mode === "none") return;

  if (!d.github_repo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["github_repo"],
      message: "Indica la URL del repositorio.",
    });
    return;
  }
  const parsed = parseGithubRepoUrl(d.github_repo);
  if (!parsed) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["github_repo"],
      message: "URL no válida. Formato: https://github.com/owner/repo",
    });
    return;
  }
  if (d.github_sync_mode === "bidirectional" && !d.github_installation_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["github_installation_id"],
      message: "Se necesita el Installation ID de la GitHub App para sync bidireccional.",
    });
  }
};

export const ProjectInput = ProjectBase.superRefine(projectRefinement);

export type ProjectInputType = z.infer<typeof ProjectInput>;

export const UpdateProjectInput = ProjectBase.extend({
  id: z.string().uuid("ID de proyecto inválido"),
}).superRefine(projectRefinement);

export type UpdateProjectInputType = z.infer<typeof UpdateProjectInput>;
