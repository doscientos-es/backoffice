import { NextResponse } from 'next/server'

import { serverEnv } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CACHE_SECONDS = 300
const MONITORS = [
  { hostname: 'doscientos.es', label: 'Web' },
  { hostname: 'app.doscientos.es', label: 'Aplicación' },
] as const

type UptimeMonitor = {
  url: string
  status: string
}

function responseHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=600`,
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: responseHeaders() })
}

export async function GET() {
  const apiKey = serverEnv().UPTIMEROBOT_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'status_unavailable' },
      { status: 503, headers: responseHeaders() },
    )
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)
  try {
    const response = await fetch('https://api.uptimerobot.com/v3/monitors', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      next: { revalidate: CACHE_SECONDS },
    })
    if (!response.ok) {
      return NextResponse.json(
        { error: 'status_unavailable' },
        { status: 503, headers: responseHeaders() },
      )
    }

    const payload = (await response.json()) as { data?: UptimeMonitor[] }
    const available = payload.data ?? []
    const monitors = MONITORS.map(({ hostname, label }) => {
      const monitor = available.find((item) => {
        try {
          return new URL(item.url).hostname.toLowerCase() === hostname
        } catch {
          return false
        }
      })
      return { label, status: monitor?.status ?? 'UNKNOWN' }
    })

    return NextResponse.json(
      { monitors, updatedAt: new Date().toISOString() },
      { headers: responseHeaders() },
    )
  } catch {
    return NextResponse.json(
      { error: 'status_unavailable' },
      { status: 503, headers: responseHeaders() },
    )
  } finally {
    clearTimeout(timeout)
  }
}
