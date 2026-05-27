-- ============================================================
-- GitHub integration mode per project
--
-- Problema: hasta ahora, cualquier proyecto con `github_repo` se trataba
-- igual. Pero hay 2 escenarios distintos:
--   1) Repos PROPIOS (Doscientos) → queremos sync bidireccional automático
--      (crear issues al crear tasks, milestones, leer webhooks, etc.)
--   2) Repos EXTERNOS (cliente, p.ej. Palumba) → solo guardamos el enlace
--      como referencia; el backoffice NUNCA debe modificar nada en GitHub.
--
-- Esta migración:
--   • Añade `github_sync_mode` enum textual con check constraint
--   • Añade `github_auto_sync` para apagar el sync automático puntualmente
--   • Añade `github_synced_at` (timestamp del último sync correcto)
--   • Backfill de filas existentes según el estado actual
--   • Coherencia: si mode != 'none' debe haber datos suficientes
-- ============================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS github_sync_mode  text        NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS github_auto_sync  boolean     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS github_synced_at  timestamptz;

-- Backfill: clasificar lo que ya hay en la tabla.
--   • Con installation_id + owner + name      → bidirectional
--   • Solo con URL del repo                    → link_only
--   • Resto                                    → none (default)
UPDATE projects
SET github_sync_mode = 'bidirectional'
WHERE github_sync_mode = 'none'
  AND github_installation_id IS NOT NULL
  AND github_repo_owner      IS NOT NULL
  AND github_repo_name       IS NOT NULL;

UPDATE projects
SET github_sync_mode = 'link_only'
WHERE github_sync_mode = 'none'
  AND github_repo IS NOT NULL;

-- Constraint: valores permitidos.
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_github_sync_mode_check;
ALTER TABLE projects
  ADD CONSTRAINT projects_github_sync_mode_check
  CHECK (github_sync_mode IN ('none','link_only','bidirectional'));

-- Constraint: consistencia de datos por modo.
--   • link_only      → al menos github_repo
--   • bidirectional  → owner + name + installation_id
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_github_sync_mode_consistency;
ALTER TABLE projects
  ADD CONSTRAINT projects_github_sync_mode_consistency
  CHECK (
    github_sync_mode = 'none'
    OR (
      github_sync_mode = 'link_only'
      AND github_repo IS NOT NULL
    )
    OR (
      github_sync_mode = 'bidirectional'
      AND github_repo_owner      IS NOT NULL
      AND github_repo_name       IS NOT NULL
      AND github_installation_id IS NOT NULL
    )
  );

-- Índice parcial para listar rápidamente los proyectos en sync activo.
CREATE INDEX IF NOT EXISTS idx_projects_github_sync_mode
  ON projects(github_sync_mode)
  WHERE github_sync_mode <> 'none';

COMMENT ON COLUMN projects.github_sync_mode IS
  'none = sin integración. link_only = solo guardamos enlace al repo, el backoffice nunca modifica GitHub. bidirectional = sync completo (issues/milestones/webhooks).';
COMMENT ON COLUMN projects.github_auto_sync IS
  'Si true (default), al crear/actualizar tareas/hitos se sincroniza automáticamente con GitHub. Solo aplica si github_sync_mode = bidirectional.';
COMMENT ON COLUMN projects.github_synced_at IS
  'Timestamp del último sync correcto con GitHub (issue/milestone creado o webhook procesado).';
