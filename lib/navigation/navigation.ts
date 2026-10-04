import {
  Archive,
  ChartBar as BarChart3,
  Bell,
  CalendarDays,
  CheckSquare,
  FileText as FileSignature,
  Folder as FolderKanban,
  Globe,
  House as Home,
  Images,
  Inbox,
  Key as KeyRound,
  LifeBuoy,
  Mail,
  Megaphone,
  MousePointerClick,
  Receipt,
  Repeat,
  Share2,
  Users,
  Wallet,
} from 'lucide-react'
import type { ComponentType } from 'react'

import type { MemberRole } from '@/lib/auth'
import { can, type PermissionKey } from '@/lib/permissions'

export type NavigationItem = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  requires?: PermissionKey
}

export type NavigationGroup = {
  label?: string
  items: NavigationItem[]
}

/** Single source of truth for sidebar, mobile drawer and command palette. */
export const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    items: [{ href: '/inicio', label: 'Inicio', icon: Home }],
  },
  {
    label: 'Trabajo diario',
    items: [
      { href: '/calendar', label: 'Agenda', icon: CalendarDays },
      { href: '/tasks', label: 'Tareas', icon: CheckSquare },
      { href: '/reminders', label: 'Recordatorios', icon: Bell },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { href: '/leads', label: 'Leads', icon: Inbox, requires: 'leads.read' },
      { href: '/leads/recovery', label: 'Repesca', icon: LifeBuoy, requires: 'leads.read' },
      { href: '/clients', label: 'Clientes', icon: Users, requires: 'clients.read' },
      { href: '/proposals', label: 'Propuestas', icon: FileSignature, requires: 'proposals.read' },
    ],
  },
  {
    label: 'Entrega',
    items: [
      { href: '/projects', label: 'Proyectos', icon: FolderKanban, requires: 'projects.read' },
      { href: '/webs', label: 'Webs', icon: Globe, requires: 'marketing.read' },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { href: '/invoices', label: 'Facturas', icon: Receipt, requires: 'finance.read' },
      { href: '/subscriptions', label: 'Suscripciones', icon: Repeat, requires: 'finance.read' },
      { href: '/finance', label: 'Finanzas', icon: Wallet, requires: 'finance.read' },
      {
        href: '/finance/portfolio',
        label: 'Portfolio',
        icon: BarChart3,
        requires: 'finance.read',
      },
    ],
  },
  {
    label: 'Growth',
    items: [
      { href: '/marketing', label: 'Publicidad', icon: Megaphone, requires: 'marketing.read' },
      {
        href: '/marketing/newsletters',
        label: 'Newsletters',
        icon: Mail,
        requires: 'marketing.read',
      },
      {
        href: '/marketing/events',
        label: 'Eventos',
        icon: MousePointerClick,
        requires: 'marketing.read',
      },
      { href: '/social', label: 'Social', icon: Share2, requires: 'marketing.read' },
    ],
  },
  {
    label: 'Espacio de trabajo',
    items: [
      { href: '/internal-docs', label: 'Docs internos', icon: Archive },
      { href: '/brand', label: 'Marca', icon: Images },
      { href: '/settings/team', label: 'Equipo', icon: Users, requires: 'team.manage' },
      { href: '/vault', label: 'Bóveda', icon: KeyRound, requires: 'vault.read' },
    ],
  },
]

export function visibleNavigationGroups(role: MemberRole) {
  return NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.requires || can(role, item.requires)),
  })).filter((group) => group.items.length > 0)
}
