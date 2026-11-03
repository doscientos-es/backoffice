import type { CallBriefing } from '@/lib/leads/call-briefing'
import { formatEUR } from '@/lib/utils'

export function CallBriefingCard({
  briefing,
  compact = false,
}: {
  briefing: CallBriefing
  compact?: boolean
}) {
  return (
    <section aria-label="Resumen del lead y comercial" className="space-y-3 text-sm">
      {!compact ? (
        <div>
          <h2 className="text-sm font-semibold">Información rápida</h2>
          <p className="mt-3 font-medium">{briefing.name}</p>
          {briefing.company ? <p className="text-muted-foreground">{briefing.company}</p> : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {briefing.leadStatus ? <span>Estado: {briefing.leadStatus}</span> : null}
        {briefing.estimatedValue != null ? (
          <span>
            Valor estimado:{' '}
            <strong className="font-medium text-foreground">
              {formatEUR(briefing.estimatedValue)}
            </strong>
          </span>
        ) : null}
        {briefing.solutionType ? <span>{briefing.solutionType}</span> : null}
        {briefing.urgency ? <span>Plazo: {briefing.urgency}</span> : null}
      </div>
      {briefing.summary ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            {briefing.summaryOrigin === 'ai'
              ? 'Resumen IA · contrasta los datos'
              : 'Notas del lead'}
          </p>
          <p className="text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">
            {compact && briefing.summary.length > 220
              ? `${briefing.summary.slice(0, 220)}…`
              : briefing.summary}
          </p>
          {compact && briefing.summary.length > 220 ? (
            <details className="text-xs">
              <summary className="cursor-pointer py-1 font-medium text-primary">
                Leer resumen completo
              </summary>
              <p className="mt-1 leading-relaxed wrap-break-word whitespace-pre-wrap">
                {briefing.summary}
              </p>
            </details>
          ) : null}
        </div>
      ) : compact ? (
        <p className="text-xs text-muted-foreground">Todavía no hay un resumen del lead.</p>
      ) : null}
      <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5">
        <p className="text-xs font-medium">Contexto comercial</p>
        {briefing.proposals.length ? (
          <ul className="mt-2 space-y-2 text-xs">
            {briefing.proposals.map((proposal, index) => (
              <li
                key={`${proposal.title}-${index}`}
                className="flex items-start justify-between gap-3"
              >
                <span className="min-w-0 wrap-break-word">
                  {proposal.title}
                  <span className="text-muted-foreground"> · {proposal.status}</span>
                </span>
                {proposal.total != null ? (
                  <span className="shrink-0 font-medium">{formatEUR(proposal.total)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">Sin propuestas registradas.</p>
        )}
        {briefing.invoiceCount != null ? (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-xs text-muted-foreground">
            <span>Facturas consultadas: {briefing.invoiceCount}</span>
            {briefing.paidTotal != null ? (
              <span>Pagado: {formatEUR(briefing.paidTotal)}</span>
            ) : null}
            {briefing.outstandingTotal != null ? (
              <span>
                Pendiente:{' '}
                <strong className="font-medium text-foreground">
                  {formatEUR(briefing.outstandingTotal)}
                </strong>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {!compact ? (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Preguntas para la llamada
          </p>
          {briefing.questions.length ? (
            <ul className="list-disc space-y-2 pl-4">
              {briefing.questions.map((item, index) => (
                <li key={`${item.question}-${index}`}>{item.question}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Aún no hay preguntas preparadas.</p>
          )}
        </div>
      ) : null}
    </section>
  )
}
