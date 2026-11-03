import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const updateLeadMomTestSignal = vi.hoisted(() => vi.fn())

vi.mock('../actions', () => ({ updateLeadMomTestSignal }))
vi.mock('sileo', () => ({ sileo: { error: vi.fn() } }))

import { MomTestChecklist, type MomTestValues } from './mom-test-checklist'

const initialValues: MomTestValues = {
  real_problem: null,
  aware_problem: null,
  tried_solutions: null,
  decision_power_or_budget: null,
  accessible: null,
  comparing_other_companies: null,
}

describe('MomTestChecklist score', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateLeadMomTestSignal.mockResolvedValue({ ok: true })
  })

  it('shows one score in the header without a second pending counter', () => {
    render(
      <>
        <div id="qualification-score" data-testid="qualification-score" />
        <MomTestChecklist
          leadId="lead-1"
          initialValues={initialValues}
          canEdit={false}
          scoreSlotId="qualification-score"
        />
      </>,
    )

    expect(screen.getAllByText('0/6 señales positivas')).toHaveLength(1)
    expect(
      within(screen.getByTestId('qualification-score')).getByText('0/6 señales positivas'),
    ).toBeTruthy()
    expect(screen.queryByText(/por validar/)).toBeNull()
  })

  it('updates the single score and counts not comparing as a positive signal', async () => {
    render(<MomTestChecklist leadId="lead-1" initialValues={initialValues} canEdit />)

    fireEvent.click(screen.getByRole('button', { name: 'Comparando con otras empresas: no' }))

    await waitFor(() => {
      expect(screen.getAllByText('1/6 señales positivas')).toHaveLength(1)
      expect(updateLeadMomTestSignal).toHaveBeenCalledWith({
        leadId: 'lead-1',
        signal: 'comparing_other_companies',
        value: false,
      })
    })
    expect(screen.queryByText(/por validar/)).toBeNull()
  })
})
