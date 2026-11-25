import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { TimelineChart } from './timeline-chart'

const design = {
  id: 'design',
  title: 'Diseño',
  description: 'Diseño y revisión',
  start_date: '2028-02-28',
  end_date: '2028-02-29',
}
const delivery = {
  id: 'delivery',
  title: 'Entrega',
  description: '',
  start_date: '2028-03-02',
  end_date: '2028-03-02',
}
const items = [design, delivery]
const props = { proposalId: 'proposal', proposalTitle: 'Proyecto', language: 'es' as const }

describe('TimelineChart', () => {
  afterEach(cleanup)

  it('shows compact milestones and expands their descriptions', () => {
    render(<TimelineChart {...props} items={items} />)
    expect(screen.getByText('2 hitos')).toBeDefined()
    const summary = screen.getByText('Diseño').closest('summary')
    const details = summary?.closest('details')
    expect(details?.open).toBe(false)
    expect(screen.getByText('Entrega').closest('summary')).toBeNull()
    if (!summary) throw new Error('Missing milestone summary')
    fireEvent.click(summary)
    expect(details?.open).toBe(true)
    expect(details?.textContent).toContain('Diseño y revisión')
    expect(
      screen
        .getAllByText('Diseño y revisión')
        .some((element) => element.className.includes('print:block')),
    ).toBe(true)
    fireEvent.click(summary)
    expect(details?.open).toBe(false)
  })

  it('keeps the complete scale and calendar when a deck slide shows a subset', () => {
    render(<TimelineChart {...props} items={[delivery]} allItems={items} />)
    expect(screen.queryByText('Diseño')).toBeNull()
    expect(screen.getByText('02')).toBeDefined()
    const bar = screen.getByText('Entrega').closest('li')?.querySelector('[style]') as HTMLElement
    expect(bar.style.marginLeft).toBe('75%')
    expect(bar.style.width).toBe('25%')
    const calendar = screen.getByRole('link', { name: /añadir a mi calendario/i })
    expect(
      decodeURIComponent(calendar.getAttribute('href') ?? '').match(/BEGIN:VEVENT/g),
    ).toHaveLength(2)
  })

  it('localizes the milestone count and calendar action', () => {
    render(<TimelineChart {...props} language="en" items={[design]} />)
    expect(screen.getByText('1 milestone')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Add to my calendar' })).toBeDefined()
  })
})
