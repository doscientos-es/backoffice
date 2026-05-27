-- ============================================================
-- Documents: technical specifications linked to proposals
-- ============================================================
-- We extend the existing `documents` table (which until now stored
-- only uploaded files) so it can also hold structured markdown
-- documents — concretely, technical specifications that travel
-- alongside a proposal and can be shared with the client through a
-- public portal token (mirroring the proposals/invoices pattern).
--
-- Design:
--   * `kind = 'file'`            → original behaviour (storage_path required).
--   * `kind = 'technical_spec'`  → markdown content (body_markdown required),
--                                  optionally linked to a proposal and project,
--                                  optionally exposed via portal_token.

-- ---- New columns ----
alter table public.documents
  add column if not exists kind              text not null default 'file',
  add column if not exists title             text,
  add column if not exists body_markdown     text,
  add column if not exists proposal_id       uuid references public.proposals(id) on delete cascade,
  add column if not exists is_client_visible boolean not null default false,
  add column if not exists portal_token      text unique default encode(gen_random_bytes(24), 'hex'),
  add column if not exists updated_at        timestamptz not null default now();

-- Allow storage_path to be null for non-file kinds.
alter table public.documents
  alter column storage_path drop not null;

-- ---- Constraints ----
-- Kind whitelist.
alter table public.documents
  drop constraint if exists documents_kind_check;
alter table public.documents
  add constraint documents_kind_check
  check (kind in ('file', 'technical_spec'));

-- A 'file' row needs a storage_path; a content-based document needs body content.
alter table public.documents
  drop constraint if exists documents_kind_payload_check;
alter table public.documents
  add constraint documents_kind_payload_check
  check (
    (kind = 'file' and storage_path is not null)
    or (kind <> 'file' and body_markdown is not null)
  );

-- ---- Indices ----
create index if not exists documents_proposal_idx
  on public.documents(proposal_id)
  where proposal_id is not null;

create index if not exists documents_kind_idx
  on public.documents(kind);

create index if not exists documents_portal_token_idx
  on public.documents(portal_token)
  where portal_token is not null;

-- ---- updated_at trigger ----
drop trigger if exists trg_touch_documents on public.documents;
create trigger trg_touch_documents
  before update on public.documents
  for each row execute function public.fn_touch_updated_at();

comment on column public.documents.kind is
  'Document kind. ''file'' = uploaded asset (storage_path); ''technical_spec'' = structured markdown linked to a proposal.';
comment on column public.documents.proposal_id is
  'When set, ties this document to a proposal so it can be sent / shown together with it.';
comment on column public.documents.is_client_visible is
  'If true, the document is surfaced in the client-facing proposal portal and email.';
comment on column public.documents.portal_token is
  'Unguessable token used to expose the document at /p/spec/[token] without auth.';


-- ============================================================
-- Proposals: intro / terms markdown blocks
-- ============================================================
-- Free-form markdown shown above (intro) and below (terms) the items table
-- in both the dashboard editor and the public portal email/page.
alter table public.proposals
  add column if not exists intro text,
  add column if not exists terms text;

comment on column public.proposals.intro is
  'Markdown shown above the items table (executive summary, context).';
comment on column public.proposals.terms is
  'Markdown shown below the items table (terms & conditions, payment).';
