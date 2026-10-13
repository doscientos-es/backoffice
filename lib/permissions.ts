import type { AccessScope, MemberRole } from '@/lib/auth'

export type PermissionKey =
  | 'leads.read'
  | 'leads.write'
  | 'leads.delete'
  | 'clients.read'
  | 'clients.write'
  | 'clients.delete'
  | 'proposals.read'
  | 'proposals.write'
  | 'proposals.delete'
  | 'proposals.prices'
  | 'projects.read'
  | 'projects.write'
  | 'projects.delete'
  | 'tasks.read'
  | 'tasks.write'
  | 'tasks.delete'
  | 'finance.read'
  | 'finance.write'
  | 'marketing.read'
  | 'marketing.write'
  | 'vault.read'
  | 'vault.write'
  | 'workspace.write'
  | 'team.manage'
  | 'settings.manage'

export const ROLE_PERMISSIONS: Readonly<Record<MemberRole, readonly PermissionKey[]>> = {
  owner: [
    'leads.read',
    'leads.write',
    'leads.delete',
    'clients.read',
    'clients.write',
    'clients.delete',
    'proposals.read',
    'proposals.write',
    'proposals.delete',
    'proposals.prices',
    'projects.read',
    'projects.write',
    'projects.delete',
    'tasks.read',
    'tasks.write',
    'tasks.delete',
    'finance.read',
    'finance.write',
    'marketing.read',
    'marketing.write',
    'vault.read',
    'vault.write',
    'workspace.write',
    'team.manage',
    'settings.manage',
  ],
  admin: [
    'leads.read',
    'leads.write',
    'leads.delete',
    'clients.read',
    'clients.write',
    'clients.delete',
    'proposals.read',
    'proposals.write',
    'proposals.delete',
    'proposals.prices',
    'projects.read',
    'projects.write',
    'projects.delete',
    'tasks.read',
    'tasks.write',
    'tasks.delete',
    'finance.read',
    'finance.write',
    'marketing.read',
    'marketing.write',
    'vault.read',
    'vault.write',
    'workspace.write',
    'team.manage',
    'settings.manage',
  ],
  member: [
    'leads.read',
    'leads.write',
    'clients.read',
    'clients.write',
    'proposals.read',
    'proposals.write',
    'proposals.prices',
    'projects.read',
    'projects.write',
    'tasks.read',
    'tasks.write',
    'workspace.write',
  ],
  sales: [
    'leads.read',
    'leads.write',
    'clients.read',
    'clients.write',
    'proposals.read',
    'proposals.write',
    'proposals.prices',
    'projects.read',
    'tasks.read',
    'tasks.write',
    'workspace.write',
  ],
  delivery: [
    'clients.read',
    'proposals.read',
    'projects.read',
    'projects.write',
    'tasks.read',
    'tasks.write',
    'workspace.write',
  ],
  accountant: [
    'clients.read',
    'clients.write',
    'proposals.read',
    'proposals.prices',
    'projects.read',
    'tasks.read',
    'finance.read',
    'finance.write',
    'workspace.write',
  ],
  viewer: ['leads.read', 'clients.read', 'proposals.read', 'projects.read', 'tasks.read'],
}

export const ROLE_OPTIONS: ReadonlyArray<{
  value: MemberRole
  label: string
  description: string
}> = [
  { value: 'owner', label: 'Propietario', description: 'Acceso completo y gestión del equipo.' },
  { value: 'admin', label: 'Administrador', description: 'Acceso completo y gestión del equipo.' },
  {
    value: 'member',
    label: 'Miembro',
    description: 'Colaboración general sin finanzas ni administración.',
  },
  { value: 'sales', label: 'Comercial', description: 'Leads, clientes y propuestas con precios.' },
  {
    value: 'delivery',
    label: 'Entrega',
    description: 'Proyectos y tareas; sin acceso a precios ni finanzas.',
  },
  {
    value: 'accountant',
    label: 'Finanzas',
    description: 'Facturación y lectura de la actividad comercial.',
  },
  {
    value: 'viewer',
    label: 'Solo lectura',
    description: 'Consulta de registros asignados, sin cambios.',
  },
]

export const ACCESS_SCOPE_OPTIONS: ReadonlyArray<{
  value: AccessScope
  label: string
  description: string
}> = [
  {
    value: 'assigned',
    label: 'Solo asignados',
    description: 'Registros asignados, creados o vinculados a la persona.',
  },
  {
    value: 'all',
    label: 'Todos',
    description: 'Todos los registros de los módulos permitidos por su rol.',
  },
]

export function can(role: MemberRole, permission: PermissionKey): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

export function permissionsForRole(role: MemberRole): readonly PermissionKey[] {
  return ROLE_PERMISSIONS[role]
}

export function effectiveAccessScope(role: MemberRole, scope: AccessScope): AccessScope {
  return role === 'owner' || role === 'admin' ? 'all' : scope
}
