import { z } from 'zod'

import type { PortalLanguage } from '@/lib/portal/language'

const dateInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Indica una fecha válida')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`)
    return (
      value >= '1900-01-01' &&
      value <= '9998-12-31' &&
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    )
  }, 'Indica una fecha válida')

export const timelineItemInput = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(1, 'Indica qué haremos').max(120),
    description: z.string().trim().max(500),
    start_date: dateInput,
    end_date: dateInput,
  })
  .refine((item) => item.end_date >= item.start_date, {
    path: ['end_date'],
    message: 'La fecha final debe ser igual o posterior a la inicial',
  })

export const timelineInput = z.array(timelineItemInput).max(60)
export type TimelineItem = z.infer<typeof timelineItemInput>

export function parseTimeline(value: unknown): TimelineItem[] {
  const result = timelineInput.safeParse(value ?? [])
  return result.success ? result.data : []
}

const day = 86_400_000
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / day

export function nextTimelineWeek(endDate: string) {
  if (!dateInput.safeParse(endDate).success) return null
  const start = new Date((dayNumber(endDate) + 1) * day).toISOString().slice(0, 10)
  const end = new Date((dayNumber(endDate) + 7) * day).toISOString().slice(0, 10)
  return dateInput.safeParse(end).success ? { start_date: start, end_date: end } : null
}

export function formatTimelineDate(date: string, language: PortalLanguage) {
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : `${language}-ES`, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

export function timelineLayout(items: TimelineItem[]) {
  if (!items.length) return []
  const start = Math.min(...items.map((item) => dayNumber(item.start_date)))
  const end = Math.max(...items.map((item) => dayNumber(item.end_date))) + 1
  return [...items]
    .sort(
      (a, b) => a.start_date.localeCompare(b.start_date) || a.end_date.localeCompare(b.end_date),
    )
    .map((item) => ({
      item,
      left: ((dayNumber(item.start_date) - start) / (end - start)) * 100,
      width: ((dayNumber(item.end_date) + 1 - dayNumber(item.start_date)) / (end - start)) * 100,
    }))
}

function escapeCalendarText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

// RFC 5545 limits lines to 75 octets, including the continuation space.
function foldLine(line: string) {
  const encoder = new TextEncoder()
  const parts: string[] = []
  let part = ''
  let bytes = 0
  for (const character of line) {
    const size = encoder.encode(character).length
    if (bytes + size > 75) {
      parts.push(part)
      part = ' '
      bytes = 1
    }
    part += character
    bytes += size
  }
  parts.push(part)
  return parts.join('\r\n')
}

export function timelineCalendar(items: TimelineItem[], proposalId: string, proposalTitle: string) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//doscientos//Propuesta//ES',
    'CALSCALE:GREGORIAN',
  ]
  for (const { item } of timelineLayout(items)) {
    const nextDay = new Date((dayNumber(item.end_date) + 1) * day).toISOString().slice(0, 10)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${item.id}@doscientos-${proposalId}`,
      'DTSTAMP:20000101T000000Z',
      `DTSTART;VALUE=DATE:${item.start_date.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${nextDay.replace(/-/g, '')}`,
      `SUMMARY:${escapeCalendarText(`${proposalTitle}: ${item.title}`)}`,
      `DESCRIPTION:${escapeCalendarText(item.description)}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return `${lines.map(foldLine).join('\r\n')}\r\n`
}

export function timelineCalendarHref(
  items: TimelineItem[],
  proposalId: string,
  proposalTitle: string,
) {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(timelineCalendar(items, proposalId, proposalTitle))}`
}
