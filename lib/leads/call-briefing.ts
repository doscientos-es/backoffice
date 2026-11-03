/** Small, serializable briefing shared by the desktop workspace and the mobile call page. */
export type CallBriefing = {
  name: string
  company: string | null
  leadStatus: string | null
  estimatedValue: number | null
  summary?: string | null
  summaryOrigin?: 'ai' | 'notes' | null
  solutionType?: string | null
  urgency?: string | null
  questions: Array<{
    question: string
    status: string
    rationale?: string | null
  }>
  proposals: Array<{ title: string; status: string; total: number | null }>
  /** Null means unavailable or not permitted, never a confirmed zero. */
  invoiceCount: number | null
  paidTotal: number | null
  outstandingTotal: number | null
}

export type CallWorkspaceData = { briefing: CallBriefing; aiEnabled: boolean }
