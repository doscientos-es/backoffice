import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../actions', () => ({ syncLeadGmail: vi.fn() }))
vi.mock('sileo', () => ({ sileo: { error: vi.fn(), success: vi.fn() } }))

import { GmailSyncButton } from './gmail-sync-button'

describe('GmailSyncButton', () => {
  it('uses the generic mail icon instead of the Gmail logo', () => {
    const { container } = render(<GmailSyncButton leadId="lead-1" leadEmail="test@example.com" />)

    expect(screen.getByRole('button', { name: 'Sincronizar Gmail' })).not.toBeNull()
    expect(container.querySelector('svg.lucide-mail')).not.toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })
})
