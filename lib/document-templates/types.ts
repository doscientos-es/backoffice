export type DocumentTemplateFieldRole = 'internal' | 'recipient'
export type DocumentTemplateFieldKind = 'text' | 'checkbox' | 'dropdown' | 'radio' | 'option_list'

export type DocumentTemplateField = {
  name: string
  label: string
  kind: DocumentTemplateFieldKind
  required: boolean
  role: DocumentTemplateFieldRole
  source: string | null
}

export type DocumentTemplate = {
  id: string
  name: string
  slug: string
  description: string | null
  storage_path: string
  mime_type: string
  size_bytes: number
  fields: DocumentTemplateField[]
  version: number
  is_active: boolean
  created_at: string
}

export type DocumentGenerationContext = {
  lead: Record<string, unknown> | null
  client: Record<string, unknown> | null
  project: Record<string, unknown> | null
  company: Record<string, unknown> | null
}
