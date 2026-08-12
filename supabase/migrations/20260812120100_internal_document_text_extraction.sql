-- Native PDF text extraction for internal documents. This does not perform OCR.

create table if not exists public.internal_document_extractions (
  document_id      uuid primary key references public.internal_documents(id) on delete cascade,
  source_version   int not null,
  status           text not null check (status in ('processing', 'extracted', 'no_text', 'unsupported', 'failed')),
  page_count       int not null default 0,
  truncated        boolean not null default false,
  extraction_error text,
  extracted_at     timestamptz,
  updated_at       timestamptz not null default now()
);

create table if not exists public.internal_document_text_pages (
  document_id    uuid not null references public.internal_documents(id) on delete cascade,
  source_version int not null,
  page_number    int not null check (page_number > 0),
  content        text not null check (char_length(content) <= 100000),
  content_search tsvector generated always as (to_tsvector('spanish', content)) stored,
  primary key (document_id, source_version, page_number)
);

create index if not exists internal_document_text_pages_search_idx
  on public.internal_document_text_pages using gin (content_search);

alter table public.internal_document_extractions enable row level security;
alter table public.internal_document_text_pages enable row level security;

drop policy if exists internal_document_extractions_select on public.internal_document_extractions;
create policy internal_document_extractions_select on public.internal_document_extractions
  for select using (
    exists (
      select 1 from public.internal_documents
      where internal_documents.id = internal_document_extractions.document_id
        and internal_documents.deleted_at is null
        and public.is_team_member()
        and (internal_documents.visibility = 'all_team' or public.current_member_role() in ('owner', 'admin'))
    )
  );

drop policy if exists internal_document_text_pages_select on public.internal_document_text_pages;
create policy internal_document_text_pages_select on public.internal_document_text_pages
  for select using (
    exists (
      select 1 from public.internal_documents
      where internal_documents.id = internal_document_text_pages.document_id
        and internal_documents.deleted_at is null
        and public.is_team_member()
        and (internal_documents.visibility = 'all_team' or public.current_member_role() in ('owner', 'admin'))
    )
  );

-- A separate credential is required before the MCP may inspect admins_only docs.
-- It is optional and intended for a private, administrator-owned MCP instance.
create table if not exists public.mcp_document_admin_api_keys (
  token_hash text primary key,
  created_at timestamptz not null default now()
);
alter table public.mcp_document_admin_api_keys enable row level security;
revoke all on table public.mcp_document_admin_api_keys from public, anon, authenticated;

create or replace function public.has_valid_mcp_document_admin_token()
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  with request_key as (
    select nullif(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-mcp-admin-documents-key', '') as raw_key
  )
  select exists (
    select 1 from public.mcp_document_admin_api_keys, request_key
    where token_hash = encode(extensions.digest(request_key.raw_key, 'sha256'), 'hex')
  );
$$;
revoke all on function public.has_valid_mcp_document_admin_token() from public, anon, authenticated;
grant execute on function public.has_valid_mcp_document_admin_token() to anon, authenticated;

create or replace function public.rotate_mcp_document_admin_api_key(raw_key text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only service_role may rotate the MCP document admin API key';
  end if;
  if length(raw_key) < 48 then
    raise exception 'MCP document admin API key must be at least 48 characters';
  end if;
  delete from public.mcp_document_admin_api_keys where token_hash is not null;
  insert into public.mcp_document_admin_api_keys (token_hash)
  values (encode(extensions.digest(raw_key, 'sha256'), 'hex'));
end;
$$;
revoke all on function public.rotate_mcp_document_admin_api_key(text) from public, anon, authenticated;
grant execute on function public.rotate_mcp_document_admin_api_key(text) to service_role;

grant select on table public.internal_document_extractions, public.internal_document_text_pages to anon, authenticated;

drop policy if exists mcp_reader_select on public.internal_documents;
create policy mcp_reader_select on public.internal_documents
  for select to anon, authenticated
  using (
    public.has_valid_mcp_access_token()
    and deleted_at is null
    and (visibility = 'all_team' or public.has_valid_mcp_document_admin_token())
  );

create policy mcp_reader_select on public.internal_document_extractions
  for select to anon, authenticated
  using (
    public.has_valid_mcp_access_token()
    and exists (
      select 1 from public.internal_documents
      where internal_documents.id = internal_document_extractions.document_id
        and internal_documents.deleted_at is null
        and (internal_documents.visibility = 'all_team' or public.has_valid_mcp_document_admin_token())
    )
  );

create policy mcp_reader_select on public.internal_document_text_pages
  for select to anon, authenticated
  using (
    public.has_valid_mcp_access_token()
    and exists (
      select 1 from public.internal_documents
      where internal_documents.id = internal_document_text_pages.document_id
        and internal_documents.deleted_at is null
        and (internal_documents.visibility = 'all_team' or public.has_valid_mcp_document_admin_token())
    )
  );