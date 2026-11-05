import type { createServerClient } from '@/lib/supabase/server'

type Client = Awaited<ReturnType<typeof createServerClient>>
export type ResendActivity = { openedAt: string | null; clickedAt: string | null; links: string[] }

/** Reads historical provider events in bounded batches; no IP addresses or user agents are exposed. */
export async function getResendActivity(client: Client, emailIds: string[]) {
  const activity = new Map<string, ResendActivity>()
  const ids = [...new Set(emailIds.filter(Boolean))]
  for (let start = 0; start < ids.length; start += 200) {
    const batch = ids.slice(start, start + 200)
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client
        .from('lead_interactions')
        .select('resend_email_id, type, payload, created_at')
        .in('resend_email_id', batch)
        .in('type', ['email_opened', 'email_clicked'])
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + 999)
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as Array<{
        resend_email_id: string
        type: string
        payload: {
          event_created_at?: unknown
          click?: { link?: unknown; timestamp?: unknown }
        } | null
        created_at: string
      }>
      for (const row of rows) {
        const current = activity.get(row.resend_email_id) ?? {
          openedAt: null,
          clickedAt: null,
          links: [],
        }
        if (row.type === 'email_opened') {
          const stamp = row.payload?.event_created_at
          current.openedAt ??=
            typeof stamp === 'string' && !Number.isNaN(Date.parse(stamp)) ? stamp : row.created_at
        }
        if (row.type === 'email_clicked') {
          const stamp = row.payload?.click?.timestamp
          const eventStamp = row.payload?.event_created_at
          current.clickedAt ??=
            typeof stamp === 'string' && !Number.isNaN(Date.parse(stamp))
              ? stamp
              : typeof eventStamp === 'string' && !Number.isNaN(Date.parse(eventStamp))
                ? eventStamp
                : row.created_at
          const raw = row.payload?.click?.link
          if (typeof raw === 'string') {
            try {
              const url = new URL(raw)
              if (url.protocol === 'https:' || url.protocol === 'http:') {
                // Resend may report our redirect rather than its destination.
                const target = url.pathname.startsWith('/api/track/click/')
                  ? url.searchParams.get('url')
                  : null
                const link = target ? new URL(target) : url
                if (
                  (link.protocol === 'https:' || link.protocol === 'http:') &&
                  !current.links.includes(link.href)
                )
                  current.links.push(link.href)
              }
            } catch {
              /* Ignore malformed links from providers. */
            }
          }
        }
        activity.set(row.resend_email_id, current)
      }
      if (rows.length < 1000) break
    }
  }
  return activity
}
