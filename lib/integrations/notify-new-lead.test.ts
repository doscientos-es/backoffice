import { beforeEach, describe, expect, it, vi } from 'vitest'

type Member = {
  id: string
  email: string | null
  role: string
  leads_assignable: boolean
  deleted_at: string | null
}

const { state, sendEmail, renderEmail, dispatchNotifications, logError } = vi.hoisted(() => ({
  state: { members: [] as Member[], fetchError: null as Error | null },
  sendEmail: vi.fn(),
  renderEmail: vi.fn(),
  dispatchNotifications: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      expect(table).toBe('team_members')
      const filters: Record<string, unknown> = {}
      const query = {
        select: () => query,
        eq: (field: string, value: unknown) => {
          filters[field] = value
          return query
        },
        is: async (field: string, value: unknown) => {
          filters[field] = value
          return {
            data: state.members.filter((member) =>
              Object.entries(filters).every(
                ([key, expected]) => member[key as keyof Member] === expected,
              ),
            ),
            error: state.fetchError,
          }
        },
      }
      return query
    },
  }),
}))
vi.mock('@/components/email/new-lead-email', () => ({ NewLeadEmail: vi.fn(() => null) }))
vi.mock('@/lib/email/render', () => ({ renderEmail }))
vi.mock('@/lib/email/resend', () => ({ sendEmail }))
vi.mock('@/lib/env', () => ({
  publicEnv: { NEXT_PUBLIC_APP_URL: 'https://backoffice.example.test' },
}))
vi.mock('@/lib/notifications/dispatch', () => ({ dispatchNotifications }))
vi.mock('@/lib/logger', () => ({
  scopedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: logError }),
}))

import { notifyNewLead } from './notify-new-lead'

const lead = {
  leadId: 'lead-1',
  leadName: 'Test Lead',
  leadCompany: 'Example Company',
  leadSource: 'web',
}

function member(id: string, overrides: Partial<Member> = {}): Member {
  return {
    id,
    email: `${id}@example.test`,
    role: 'member',
    leads_assignable: true,
    deleted_at: null,
    ...overrides,
  }
}

function sentTo() {
  return sendEmail.mock.calls.map(([input]) => input.to)
}

describe('notifyNewLead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.members = [member('sales-member'), member('admin', { role: 'admin' })]
    state.fetchError = null
    sendEmail.mockReset().mockResolvedValue({ id: 'email-1', mocked: false })
    renderEmail.mockReset().mockResolvedValue('<p>New lead</p>')
    dispatchNotifications.mockReset().mockResolvedValue(undefined)
  })

  it('emails sales and every active leads-enabled member, regardless of role', async () => {
    state.members.push(
      member('disabled-owner', { role: 'owner', leads_assignable: false }),
      member('deleted', { deleted_at: '2026-01-01T00:00:00Z' }),
    )

    await notifyNewLead(lead)

    expect(sentTo()).toEqual([
      'sales@doscientos.es',
      'sales-member@example.test',
      'admin@example.test',
    ])
    expect(dispatchNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientIds: ['sales-member', 'admin'],
        eventType: 'lead_new',
        entityId: lead.leadId,
        link: '/leads/lead-1',
      }),
    )
    expect(renderEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'sales-member@example.test',
        subject: 'Nuevo lead: Test Lead · Example Company',
        html: '<p>New lead</p>',
        tags: { lead_id: lead.leadId },
      }),
    )
  })

  it('deduplicates normalized email addresses and skips missing ones', async () => {
    state.members = [
      member('one', { email: ' SAME@example.test ' }),
      member('two', { email: 'same@example.test' }),
      member('shared', { email: ' SALES@DOSCIENTOS.ES ' }),
      member('missing', { email: null }),
      member('blank', { email: '  ' }),
    ]

    await notifyNewLead(lead)

    expect(sentTo()).toEqual(['sales@doscientos.es', 'same@example.test'])
    expect(dispatchNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ recipientIds: ['one', 'two', 'shared', 'missing', 'blank'] }),
    )
  })

  it('still emails sales when no active members have leads enabled', async () => {
    state.members = [member('disabled', { leads_assignable: false })]

    await notifyNewLead(lead)

    expect(sentTo()).toEqual(['sales@doscientos.es'])
  })

  it('still emails sales when the member lookup fails', async () => {
    state.fetchError = new Error('Member lookup failed')

    await expect(notifyNewLead(lead)).resolves.toBeUndefined()

    expect(sentTo()).toEqual(['sales@doscientos.es'])
    expect(logError).toHaveBeenCalled()
  })

  it('attempts the member emails even when the shared mailbox send fails', async () => {
    sendEmail.mockRejectedValueOnce(new Error('Send failed'))

    await expect(notifyNewLead(lead)).resolves.toBeUndefined()

    expect(sentTo()).toEqual([
      'sales@doscientos.es',
      'sales-member@example.test',
      'admin@example.test',
    ])
    expect(logError).toHaveBeenCalled()
  })

  it('still emails the team when in-app or push notifications fail', async () => {
    dispatchNotifications.mockRejectedValueOnce(new Error('Push failed'))

    await expect(notifyNewLead(lead)).resolves.toBeUndefined()

    expect(sendEmail).toHaveBeenCalledTimes(3)
  })

  it('logs rendering failures without sending emails or rejecting', async () => {
    renderEmail.mockRejectedValueOnce(new Error('Render failed'))

    await expect(notifyNewLead(lead)).resolves.toBeUndefined()

    expect(sendEmail).not.toHaveBeenCalled()
    expect(logError).toHaveBeenCalled()
  })
})
