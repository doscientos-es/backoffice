import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { publicEnv } from '@/lib/env'
import { McpMeetingInput, scheduleMcpMeeting } from '@/lib/leads/mcp-meetings'
import { distributedRateLimit } from '@/lib/ratelimit'

async function readLimitedBody(request: Request): Promise<string | null> {
  const reader = request.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > 12_000) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const decoder = new TextDecoder()
  return chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join('') + decoder.decode()
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const limit = await distributedRateLimit(`mcp-meetings:${ip}`, 30, 60)
  if (!limit.success)
    return NextResponse.json({ error: 'Demasiadas solicitudes.' }, { status: 429 })
  const token = request.headers.get('x-mcp-api-key')
  if (!token || token.length < 48 || token.length > 512) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }
  const client = createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'X-MCP-API-Key': token } },
    },
  )
  const { data: authorized, error } = await client.rpc('has_valid_mcp_access_token')
  if (error || authorized !== true)
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  const body = await readLimitedBody(request)
  if (body === null)
    return NextResponse.json({ error: 'Solicitud demasiado grande.' }, { status: 413 })
  let json: unknown
  try {
    json = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }
  const input = McpMeetingInput.safeParse(json)
  if (!input.success)
    return NextResponse.json({ error: 'Datos de reunión inválidos.' }, { status: 400 })
  try {
    return NextResponse.json({ ok: true, data: await scheduleMcpMeeting(input.data) })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'No se pudo crear la reunión.' },
      { status: 400 },
    )
  }
}
