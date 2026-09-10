import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export const EXPORTABLE_TABLES = [
  'settings',
  'team_members',
  'leads',
  'lead_interactions',
  'clients',
  'projects',
  'project_checklist_items',
  'milestones',
  'work_logs',
  'time_entries',
  'tasks',
  'task_members',
  'task_comments',
  'task_tags',
  'task_tag_assignments',
  'proposals',
  'proposal_items',
  'proposal_messages',
  'proposal_specs',
  'proposal_team_members',
  'proposal_views',
  'proposal_view_events',
  'invoices',
  'invoice_items',
  'invoice_payments',
  'expenses',
  'subscriptions',
  'attachments',
  'documents',
  'internal_documents',
  'internal_document_events',
  'internal_document_extractions',
  'internal_document_text_pages',
  'email_templates',
  'lead_campaigns',
  'lead_campaign_sends',
  'marketing_campaigns',
  'marketing_ad_sets',
  'marketing_ads',
  'marketing_insights',
  'brand_guides',
  'brand_tokens',
  'brand_assets',
  'company_goals',
  'web_projects',
  'notifications',
  'notification_preferences',
  'onboarding_templates',
  'onboarding_template_items',
  'social_posts',
  'social_post_targets',
  'social_post_insights',
  'social_comments',
  'social_automation_rules',
  'social_automation_runs',
  'social_automation_events',
  'diagnostics',
  'conversion_events',
  'verifactu_ledger',
  'verifactu_outbox',
] as const

export type ExportableTable = (typeof EXPORTABLE_TABLES)[number]
export type ExportRecord = Record<string, unknown>
export type ExportOptions = { includePii?: boolean }

const PAGE_SIZE = 1_000
const SECRET_KEY =
  /(?:pass(?:word|phrase)?|secret|token|api[_-]?key|private[_-]?key|credential)/i
const PII_KEY =
  /(?:email|phone|mobile|nif|vat|address|postal|contact|name|notes|body|raw_payload|ip|device|browser)/i
const encoder = new TextEncoder()

export function isExportableTable(value: string | null): value is ExportableTable {
  return Boolean(value && EXPORTABLE_TABLES.includes(value as ExportableTable))
}

function sanitizeExportValue(value: unknown, options: ExportOptions): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeExportValue(item, options))
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value as ExportRecord).flatMap(([key, child]) => {
      if (SECRET_KEY.test(key) || (!options.includePii && PII_KEY.test(key))) return []
      return [[key, sanitizeExportValue(child, options)]]
    }),
  )
}

/** Removes secrets at every depth and excludes PII unless explicitly requested. */
export function sanitizeExportRecord(record: ExportRecord, options: ExportOptions = {}): ExportRecord {
  return sanitizeExportValue(record, options) as ExportRecord
}

export function dataToCsv(rows: ExportRecord[]): string {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  const escapeCsv = (value: unknown) => {
    const text =
      value === null || value === undefined
        ? ''
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value)
    return `"${text.replaceAll('"', '""')}"`
  }
  return [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => headers.map((h) => escapeCsv(row[h])).join(',')),
  ]
    .join('\r\n')
    .concat('\r\n')
}

function csvRow(headers: string[], row: ExportRecord): string {
  const escapeCsv = (value: unknown) => {
    const text =
      value === null || value === undefined
        ? ''
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value)
    return `"${text.replaceAll('"', '""')}"`
  }
  return headers.map((header) => escapeCsv(row[header])).join(',')
}

async function readExportPage(table: ExportableTable, from: number, options: ExportOptions) {
  const { data, error } = await createAdminClient()
    .from(table)
    .select('*')
    .range(from, from + PAGE_SIZE - 1)
  if (error) throw new Error(`No se pudo exportar ${table}: ${error.message}`)
  return ((data ?? []) as ExportRecord[]).map((row) => sanitizeExportRecord(row, options))
}

/** Streams one table in bounded pages instead of retaining its full result set. */
export function streamTableAsCsv(table: ExportableTable, options: ExportOptions = {}): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      try {
        let headers: string[] | null = null
        for (let from = 0; ; from += PAGE_SIZE) {
          const page = await readExportPage(table, from, options)
          if (!headers && page.length > 0) {
            headers = [...new Set(page.flatMap((row) => Object.keys(row)))]
            controller.enqueue(encoder.encode(`\uFEFF${csvRow(headers, Object.fromEntries(headers.map((h) => [h, h])))}\r\n`))
          }
          for (const row of page) controller.enqueue(encoder.encode(`${csvRow(headers ?? [], row)}\r\n`))
          if (page.length < PAGE_SIZE) break
        }
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })
}

/** Streams a complete operational JSON export one table page at a time. */
export function streamOperationalDataAsJson(options: ExportOptions = {}): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`{"version":2,"generatedAt":"${new Date().toISOString()}","tables":{`))
        for (const [tableIndex, table] of EXPORTABLE_TABLES.entries()) {
          if (tableIndex > 0) controller.enqueue(encoder.encode(','))
          controller.enqueue(encoder.encode(`${JSON.stringify(table)}:[`))
          let firstRow = true
          for (let from = 0; ; from += PAGE_SIZE) {
            const page = await readExportPage(table, from, options)
            for (const row of page) {
              if (!firstRow) controller.enqueue(encoder.encode(','))
              controller.enqueue(encoder.encode(JSON.stringify(row)))
              firstRow = false
            }
            if (page.length < PAGE_SIZE) break
          }
          controller.enqueue(encoder.encode(']'))
        }
        controller.enqueue(encoder.encode('}}'))
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })
}
