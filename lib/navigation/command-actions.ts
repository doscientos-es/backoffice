import type { MemberRole } from '@/lib/auth'

export type CommandAction = {
  key:
    | 'priorities'
    | 'unassigned-leads'
    | 'pending-reminders'
    | 'urgent-tasks'
    | 'pending-invoices'
    | 'overdue-invoices'
  href: string
  label: string
  description: string
  keywords: string
  requiresFinance?: boolean
}

/** Atajos que llevan directamente a trabajo pendiente, no a módulos genéricos. */
export const COMMAND_ACTIONS: readonly CommandAction[] = [
  {
    key: 'priorities',
    href: '/inicio#inicio-prioridades',
    label: 'Resolver prioridades',
    description: 'Abrir tareas, leads y cobros que requieren atención',
    keywords: 'acciones pendientes urgente centro de acciones',
  },
  {
    key: 'unassigned-leads',
    href: '/leads?attention=unassigned',
    label: 'Leads sin responsable',
    description: 'Asignar oportunidades que todavía no tienen dueño',
    keywords: 'leads asignar comercial sin dueño',
  },
  {
    key: 'pending-reminders',
    href: '/reminders?status=pending',
    label: 'Recordatorios pendientes',
    description: 'Revisar avisos personales que todavía no se han completado',
    keywords: 'recordatorios avisos pendientes',
  },
  {
    key: 'urgent-tasks',
    href: '/tasks?priority=urgent&status=todo',
    label: 'Tareas urgentes por hacer',
    description: 'Ir directamente al trabajo urgente sin completar',
    keywords: 'tareas urgentes por hacer trabajo',
  },
  {
    key: 'pending-invoices',
    href: '/invoices?status=issued',
    label: 'Cobros pendientes',
    description: 'Ver facturas emitidas que aún no constan como cobradas',
    keywords: 'facturas cobros dinero pendientes',
    requiresFinance: true,
  },
  {
    key: 'overdue-invoices',
    href: '/invoices?status=overdue',
    label: 'Facturas vencidas',
    description: 'Revisar cobros que ya han superado su vencimiento',
    keywords: 'facturas vencidas cobros morosidad',
    requiresFinance: true,
  },
]

export function visibleCommandActions(role: MemberRole): CommandAction[] {
  const canViewFinance = role === 'owner' || role === 'admin'
  return COMMAND_ACTIONS.filter((action) => !action.requiresFinance || canViewFinance)
}
