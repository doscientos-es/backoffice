'use client'

import { useCallback, useState, type SetStateAction } from 'react'

import {
  createProposalDraft,
  type InitialProposalDraft,
  type ProposalDraft,
} from './proposal-draft'

export function useProposalDraft(initial: InitialProposalDraft) {
  const [draft, setDraft] = useState(() => createProposalDraft(initial))
  const setField = useCallback(
    <Key extends keyof ProposalDraft>(key: Key) =>
      (value: SetStateAction<ProposalDraft[Key]>) => {
        setDraft((current) => ({
          ...current,
          [key]:
            typeof value === 'function'
              ? (value as (previous: ProposalDraft[Key]) => ProposalDraft[Key])(current[key])
              : value,
        }))
      },
    [],
  )
  return { draft, setField }
}
