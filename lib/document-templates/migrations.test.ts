import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '20260916120000_document_templates.sql'),
  'utf8',
)

describe('document template migration', () => {
  it('protects templates and generated documents with team RLS', () => {
    expect(migration).toContain('create table if not exists public.document_templates')
    expect(migration).toContain('create table if not exists public.generated_documents')
    expect(migration).toContain('create policy "document_templates_insert"')
    expect(migration).toContain('create policy "generated_documents_insert"')
    expect(migration).toContain("notify pgrst, 'reload schema'")
  })
})
