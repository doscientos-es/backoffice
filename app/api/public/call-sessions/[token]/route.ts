import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { completeCallSession } from '@/lib/leads/call-session'
import { distributedRateLimit } from '@/lib/ratelimit'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const Params = z.object({ token: z.string().uuid() })
const Input = z.object({ action: z.enum(['dial', 'finish']) })

type RouteContext = { params: Promise<{ token: string }> }

function completionResponse(completion: ReturnType<typeof completeCallSession>) {
  return { durationMinutes: completion.durationMinutes, defaultOutcome: completion.defaultOutcome }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const parsedParams = Params.safeParse(await context.params)
  const parsedInput = Input.safeParse(await request.json().catch(() => null))
  if (!parsedParams.success || !parsedInput.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const rateLimit = await distributedRateLimit(`public-call:${parsedParams.data.token}`, 20)
  if (!rateLimit.success) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  const supabase = createAdminClient()
  const { data: session, error } = await supabase
    .from('lead_call_sessions')
    .select('id, status, started_at, dialed_at, finished_at, expires_at')
    .eq('mobile_token', parsedParams.data.token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (error || !session) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  if (parsedInput.data.action === 'dial') {
    if (session.status === 'started') {
      const { data: updated, error: updateError } = await supabase
        .from('lead_call_sessions')
        .update({ dialed_at: new Date().toISOString(), status: 'dialing' })
        .eq('id', session.id)
        .eq('status', 'started')
        .select('id')
        .maybeSingle()
      if (updateError || !updated) return NextResponse.json({ error: 'session_changed' }, { status: 409 })
    } else if (session.status !== 'dialing') {
      return NextResponse.json({ error: 'session_closed' }, { status: 409 })
    }
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  }

  if (session.status === 'awaiting_log' && session.finished_at) {
    return NextResponse.json(
      {
        ok: true,
        ...completionResponse(completeCallSession(session.started_at, session.dialed_at, session.finished_at)),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }
  if (session.status !== 'started' && session.status !== 'dialing') {
    return NextResponse.json({ error: 'session_closed' }, { status: 409 })
  }

  const finishedAt = new Date().toISOString()
  const completion = completeCallSession(session.started_at, session.dialed_at, finishedAt)
  const { data: updated, error: updateError } = await supabase
    .from('lead_call_sessions')
    .update({ status: 'awaiting_log', finished_at: finishedAt, duration_seconds: completion.durationSeconds })
    .eq('id', session.id)
    .in('status', ['started', 'dialing'])
    .select('id')
    .maybeSingle()
  if (updateError || !updated) return NextResponse.json({ error: 'session_changed' }, { status: 409 })

  return NextResponse.json(
    { ok: true, ...completionResponse(completion) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}