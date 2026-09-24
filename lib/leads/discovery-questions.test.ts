import { describe, expect, it } from 'vitest'

import { normalizeDiscoveryQuestion, removeDuplicateDiscoverySuggestions } from './discovery-questions'
import type { LeadDiscoveryQuestion } from './types'

const existing: LeadDiscoveryQuestion[] = [
  {
    id: 'question-1',
    lead_id: 'lead-1',
    question: '¿Quién decide la asignación de los transportes?',
    category: 'decision',
    rationale: '',
    priority: 1,
    status: 'open',
    answer: null,
    suggested_answer: null,
    answer_source: null,
    source_interaction_id: null,
    evidence_excerpt: null,
    confidence: null,
    origin: 'manual',
    sort_order: 0,
    created_at: '',
    updated_at: '',
  },
]

describe('lead discovery question helpers', () => {
  it('normalizes accents, punctuation and case', () => {
    expect(normalizeDiscoveryQuestion('¿Quién decide?')).toBe('quien decide')
  })

  it('removes duplicates against saved questions and within the generated batch', () => {
    const result = removeDuplicateDiscoverySuggestions(
      [
        { question: '¿Quien decide la asignacion de los transportes?' },
        { question: '¿Qué sistemas deben integrarse?' },
        { question: 'Que sistemas deben integrarse' },
      ],
      existing,
    )

    expect(result).toEqual([{ question: '¿Qué sistemas deben integrarse?' }])
  })
})