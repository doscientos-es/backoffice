import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('../actions', () => ({
  acceptLeadDiscoverySuggestion: vi.fn(),
  createLeadDiscoveryQuestion: vi.fn(),
  dismissLeadDiscoverySuggestion: vi.fn(),
  saveLeadDiscoveryQuestion: vi.fn(),
  setLeadDiscoveryQuestionStatus: vi.fn(),
}))

import type { LeadDiscoveryQuestion } from '@/lib/leads/types'

import { LeadDiscoveryQuestionsPanel } from './lead-discovery-questions-panel'

function question(
  id: string,
  status: LeadDiscoveryQuestion['status'],
  text: string,
): LeadDiscoveryQuestion {
  return {
    id,
    lead_id: 'lead-1',
    question: text,
    category: 'workflow',
    rationale: '',
    priority: 2,
    status,
    answer: status === 'answered' ? 'Respuesta guardada' : null,
    suggested_answer: null,
    answer_source: null,
    source_interaction_id: null,
    evidence_excerpt: null,
    confidence: null,
    origin: 'manual',
    sort_order: 0,
    created_at: '',
    updated_at: '',
  }
}

describe('LeadDiscoveryQuestionsPanel', () => {
  it('focuses on unresolved questions and lets the user reveal resolved ones', () => {
    render(
      <LeadDiscoveryQuestionsPanel
        leadId="lead-1"
        initialQuestions={[
          question('open', 'open', '¿Qué queda por aclarar?'),
          question('answered', 'answered', '¿Qué ya quedó respondido?'),
          question('not-applicable', 'not_applicable', '¿Qué no aplica?'),
          question('archived', 'archived', '¿Qué fue archivado?'),
        ]}
        aiEnabled={false}
        canEdit
      />,
    )

    expect(screen.getByDisplayValue('¿Qué queda por aclarar?')).toBeTruthy()
    expect(screen.queryByDisplayValue('¿Qué ya quedó respondido?')).toBeNull()
    expect(screen.queryByDisplayValue('¿Qué no aplica?')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar resueltas (2)' }))

    expect(screen.getByDisplayValue('¿Qué ya quedó respondido?')).toBeTruthy()
    expect(screen.getByDisplayValue('¿Qué no aplica?')).toBeTruthy()
    expect(screen.queryByDisplayValue('¿Qué fue archivado?')).toBeNull()
  })
})
