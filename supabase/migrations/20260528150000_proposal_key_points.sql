-- ============================================================
-- Proposals · split `intro` into structured narrative blocks
-- ------------------------------------------------------------
-- Replaces the single `intro` markdown field with three blocks
-- that map 1-to-1 to deck slides and portal sections:
--
--   * context_markdown : free-form prose framing the engagement
--   * problems         : ordered list of `{ id, title, description }`
--   * solutions        : ordered list of `{ id, title, description }`
--
-- The legacy `intro` content is preserved by copying it verbatim
-- into `context_markdown` before the column is dropped, so no
-- proposal loses narrative on rollout. Empty/whitespace-only
-- legacy values stay NULL.
-- ============================================================

alter table public.proposals
  add column if not exists context_markdown text,
  add column if not exists problems jsonb,
  add column if not exists solutions jsonb;

update public.proposals
   set context_markdown = nullif(btrim(intro), '')
 where context_markdown is null
   and intro is not null;

alter table public.proposals
  drop column if exists intro;
