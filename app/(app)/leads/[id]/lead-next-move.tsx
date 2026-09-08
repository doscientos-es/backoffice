import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CircleDollarSign,
  FileText as FileSignature,
  Mail,
  Phone,
  Receipt as ReceiptText,
} from 'lucide-react'
import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ReminderRow } from '@/lib/dashboard/types'
import { interactionDate } from '@/lib/leads/interaction-utils'
import type {
  LeadDetailInteraction,
  LeadRelatedInvoice,
  LeadRelatedProject,
  LeadRelatedProposal,
} from '@/lib/leads/types'
import { relativeTime } from '@/lib/utils'

type NextMove = {
  label: string
  hint: string
  href: string
  cta: string
  icon: typeof Mail
  tone: string
}

type LeadNextMoveProps = {
  leadId: string
  leadStatus: string
  firstContactedAt?: string | null
  phone?: string | null
  reminders?: ReminderRow[]
  interactions?: LeadDetailInteraction[]
  proposals: LeadRelatedProposal[]
  projects: LeadRelatedProject[]
  invoices: LeadRelatedInvoice[]
}

function isActiveLeadStatus(status: string) {
  return !['won', 'lost', 'not_interested', 'archived'].includes(status)
}

function leadFeedbackHref(leadId: string, feedback: 'call' | 'schedule') {
  return `/leads/${leadId}?feedback=${feedback}`
}

function nextMove({
  leadId,
  leadStatus,
  firstContactedAt,
  phone,
  reminders,
  interactions,
  proposals,
  projects,
  invoices,
}: LeadNextMoveProps): NextMove {
  const now = new Date()
  const scheduledReminders = reminders ?? []
  const overdueReminder = scheduledReminders.find(
    (reminder) => new Date(reminder.remind_at).getTime() < now.getTime(),
  )
  const hasFutureReminder = scheduledReminders.some(
    (reminder) => new Date(reminder.remind_at).getTime() >= now.getTime(),
  )
  const latestInteraction = interactions
    ?.map(interactionDate)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
  const contactHref = leadFeedbackHref(leadId, phone ? 'call' : 'schedule')
  const contactCta = phone ? 'Registrar llamada' : 'Agendar contacto'
  const overdueInvoice = invoices.find((item) => item.status === 'overdue')
  if (overdueInvoice) {
    return {
      label: 'Reclamar el cobro pendiente',
      hint: `La factura ${overdueInvoice.full_number ?? 'vencida'} necesita seguimiento.`,
      href: `/invoices/${overdueInvoice.id}`,
      cta: 'Abrir factura',
      icon: ReceiptText,
      tone: 'border-rose-500/20 bg-rose-500/[0.06] text-rose-700 dark:text-rose-300',
    }
  }

  if (overdueReminder && isActiveLeadStatus(leadStatus)) {
    return {
      label: 'Resolver seguimiento vencido',
      hint: `“${overdueReminder.title}” venció ${relativeTime(overdueReminder.remind_at)}.`,
      href: contactHref,
      cta: contactCta,
      icon: CalendarClock,
      tone: 'border-rose-500/20 bg-rose-500/[0.06] text-rose-700 dark:text-rose-300',
    }
  }

  if (!firstContactedAt && isActiveLeadStatus(leadStatus)) {
    return {
      label: 'Registrar el primer contacto',
      hint: 'Este lead todavía no tiene actividad comercial registrada.',
      href: contactHref,
      cta: contactCta,
      icon: Phone,
      tone: 'border-primary/20 bg-primary/[0.06] text-primary',
    }
  }

  const draftProposal = proposals.find((item) => item.status === 'draft')
  if (draftProposal) {
    return {
      label: 'Completar y enviar la propuesta',
      hint: `${draftProposal.number ?? draftProposal.title ?? 'La propuesta'} está en borrador.`,
      href: `/proposals/${draftProposal.id}`,
      cta: 'Abrir propuesta',
      icon: FileSignature,
      tone: 'border-violet-500/20 bg-violet-500/[0.06] text-violet-700 dark:text-violet-300',
    }
  }

  const openProposal = proposals.find((item) => ['sent', 'viewed'].includes(item.status ?? ''))
  if (openProposal) {
    return {
      label: 'Hacer seguimiento de la propuesta',
      hint: `${openProposal.number ?? 'La propuesta'} está en circulación.`,
      href: `/proposals/${openProposal.id}`,
      cta: 'Abrir propuesta',
      icon: FileSignature,
      tone: 'border-violet-500/20 bg-violet-500/[0.06] text-violet-700 dark:text-violet-300',
    }
  }

  const activeProject = projects.find((item) => item.status === 'active')
  if (activeProject) {
    return {
      label: 'Mantener al cliente al día',
      hint: `${activeProject.name} está en ejecución.`,
      href: `/projects/${activeProject.id}`,
      cta: 'Abrir proyecto',
      icon: BriefcaseBusiness,
      tone: 'border-amber-500/20 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300',
    }
  }

  const acceptedProposal = proposals.find((item) => item.status === 'accepted')
  if (acceptedProposal) {
    return {
      label: 'Preparar la entrega acordada',
      hint: `${acceptedProposal.number ?? acceptedProposal.title ?? 'La propuesta'} ya está aceptada.`,
      href: `/proposals/${acceptedProposal.id}`,
      cta: 'Abrir propuesta',
      icon: FileSignature,
      tone: 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300',
    }
  }

  if (latestInteraction && !hasFutureReminder && isActiveLeadStatus(leadStatus)) {
    return {
      label: 'Retomar la conversación',
      hint: `La última señal fue ${relativeTime(latestInteraction)} y no hay un seguimiento programado.`,
      href: contactHref,
      cta: contactCta,
      icon: Phone,
      tone: 'border-amber-500/20 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300',
    }
  }

  if (!hasFutureReminder && isActiveLeadStatus(leadStatus)) {
    return {
      label: 'Planificar el siguiente paso',
      hint: 'No hay ningún seguimiento programado para mantener viva la oportunidad.',
      href: leadFeedbackHref(leadId, 'schedule'),
      cta: 'Agendar seguimiento',
      icon: CalendarClock,
      tone: 'border-primary/20 bg-primary/[0.06] text-primary',
    }
  }

  return {
    label: 'Crear la siguiente oportunidad',
    hint: 'El flujo no tiene una transición abierta todavía.',
    href: proposals.length ? `/proposals/new?lead_id=${leadId}` : `/leads/${leadId}`,
    cta: proposals.length ? 'Crear propuesta' : 'Ver lead',
    icon: CircleDollarSign,
    tone: 'border-primary/20 bg-primary/[0.06] text-primary',
  }
}

/** Single prescriptive next step, derived from the whole commercial context. */
export function LeadNextMove(props: LeadNextMoveProps) {
  const next = nextMove(props)
  const NextIcon = next.icon

  return (
    <Card className={`border ${next.tone}`}>
      <CardHeader>
        <CardTitle className="text-base">Siguiente movimiento</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-background/70 flex size-10 items-center justify-center rounded-xl shadow-sm">
          <NextIcon className="size-5" />
        </div>
        <h3 className="mt-4 text-base leading-snug font-semibold">{next.label}</h3>
        <p className="mt-2 text-sm opacity-80">{next.hint}</p>
        <Link
          href={next.href}
          className="mt-5 inline-flex items-center gap-2 text-sm font-medium hover:underline"
        >
          {next.cta} <ArrowRight className="size-4" />
        </Link>
      </CardContent>
    </Card>
  )
}
