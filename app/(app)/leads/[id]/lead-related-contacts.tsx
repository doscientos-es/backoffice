'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@doscientos/ui'
import {
  BriefcaseBusiness,
  Contact,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  UserRound,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { sileo } from 'sileo'

import { WhatsAppIcon } from '@/components/icons/whatsapp-icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { LeadDetailInteraction, LeadRelatedContact } from '@/lib/leads/types'
import { buildLeadVCard } from '@/lib/leads/vcard'
import { buildWhatsAppUrl } from '@/lib/leads/whatsapp'

import { archiveLeadContact, createLeadContact, updateLeadContact } from '../actions'

type ContactDraft = {
  name: string
  email: string
  phone: string
  role: string
  company: string
  notes: string
  sourceInteractionId?: string
}

type MeetSuggestion = ContactDraft & { key: string; meetingLabel: string }
const dismissedMeetSuggestions = new Set<string>()

function normalise(value: string) {
  return value
    .toLocaleLowerCase('es-ES')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function meetingSuggestions(interactions: LeadDetailInteraction[]): MeetSuggestion[] {
  const suggestions = new Map<string, MeetSuggestion>()
  for (const interaction of interactions) {
    if (
      interaction.type !== 'meeting' ||
      !interaction.payload ||
      typeof interaction.payload !== 'object'
    )
      continue
    const payload = interaction.payload as Record<string, unknown>
    const artifacts = payload.meet_artifacts
    if (!artifacts || typeof artifacts !== 'object') continue
    const participants = (artifacts as Record<string, unknown>).participants
    if (!Array.isArray(participants)) continue
    const meetingLabel = interaction.subject?.trim() || 'Reunión de Meet'
    for (const raw of participants) {
      if (!raw || typeof raw !== 'object') continue
      const participant = raw as Record<string, unknown>
      const name = typeof participant.name === 'string' ? participant.name.trim() : ''
      const email = typeof participant.email === 'string' ? participant.email.trim() : ''
      const phone = typeof participant.phone === 'string' ? participant.phone.trim() : ''
      if (!name || /^(users\/|conferenceRecords\/)/i.test(name)) continue
      const key = email.toLowerCase() || phoneDigits(phone) || normalise(name)
      if (key && !suggestions.has(key)) {
        suggestions.set(key, {
          key,
          name,
          email,
          phone,
          role: '',
          company: '',
          notes: '',
          sourceInteractionId: interaction.id,
          meetingLabel,
        })
      }
    }
  }
  return [...suggestions.values()]
}

function phoneDigits(value: string) {
  return value.replace(/\D/g, '')
}

function downloadRelatedContact(contact: LeadRelatedContact, leadId: string) {
  const vCard = buildLeadVCard({
    leadId,
    contactId: contact.id,
    name: contact.name,
    phone: contact.phone ?? '',
    email: contact.email,
    company: contact.company,
  })
  const safeName =
    Array.from(contact.name, (character) =>
      /[<>:"/\\|?*]/.test(character) || character.charCodeAt(0) < 32 ? '_' : character,
    ).join('') || 'contacto'
  const url = URL.createObjectURL(new Blob([vCard], { type: 'text/vcard;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${safeName}.vcf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function LeadRelatedContacts({
  leadId,
  leadName,
  leadCompany,
  interactions,
  contacts,
  teamNames,
  canEdit,
}: {
  leadId: string
  leadName: string
  leadCompany: string | null
  interactions: LeadDetailInteraction[]
  contacts: LeadRelatedContact[]
  teamNames: string[]
  canEdit: boolean
}) {
  const suggestions = useMemo(() => meetingSuggestions(interactions), [interactions])
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<ContactDraft | null>(null)
  const [editing, setEditing] = useState<LeadRelatedContact | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set(dismissedMeetSuggestions))
  const [busy, startTransition] = useTransition()
  const known = useMemo(() => {
    const emails = new Set(contacts.map((contact) => contact.email?.toLowerCase()).filter(Boolean))
    const phones = new Set(
      contacts.map((contact) => phoneDigits(contact.phone ?? '')).filter(Boolean),
    )
    const names = new Set(contacts.map((contact) => normalise(contact.name)))
    const internalNames = new Set(teamNames.map(normalise))
    return { emails, phones, names, internalNames }
  }, [contacts, teamNames])
  const pendingSuggestions = suggestions
    .filter(
      (suggestion) =>
        !dismissed.has(suggestion.key) &&
        !(suggestion.email && known.emails.has(suggestion.email.toLowerCase())) &&
        !(suggestion.phone && known.phones.has(phoneDigits(suggestion.phone))) &&
        !known.names.has(normalise(suggestion.name)) &&
        !known.internalNames.has(normalise(suggestion.name)),
    )
    .sort((left, right) => left.meetingLabel.localeCompare(right.meetingLabel, 'es'))

  function beginCreate(contact?: ContactDraft) {
    setEditing(null)
    setDraft({
      name: contact?.name ?? '',
      email: contact?.email ?? '',
      phone: contact?.phone ?? '',
      role: contact?.role ?? '',
      company: contact?.company || leadCompany || '',
      notes: contact?.notes ?? '',
      sourceInteractionId: contact?.sourceInteractionId,
    })
    setOpen(true)
  }

  function beginEdit(contact: LeadRelatedContact) {
    setEditing(contact)
    setDraft({
      name: contact.name,
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      role: contact.role ?? '',
      company: contact.company ?? '',
      notes: contact.notes ?? '',
    })
    setOpen(true)
  }

  function saveContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft) return
    startTransition(async () => {
      const payload = {
        leadId,
        name: draft.name,
        email: draft.email,
        phone: draft.phone,
        role: draft.role,
        company: draft.company,
        notes: draft.notes,
      }
      const result = editing
        ? await updateLeadContact({
            ...payload,
            source: editing.source,
            contactId: editing.id,
            expectedVersion: editing.version,
          })
        : await createLeadContact({
            ...payload,
            source: draft.sourceInteractionId ? 'meet' : 'manual',
            sourceInteractionId: draft.sourceInteractionId,
          })
      if (!result.ok) {
        sileo.error({ title: result.error })
        return
      }
      sileo.success({ title: editing ? 'Contacto actualizado' : 'Contacto vinculado al lead' })
      if (!editing && draft.sourceInteractionId) {
        dismissedMeetSuggestions.add(
          draft.email.toLowerCase() || phoneDigits(draft.phone) || normalise(draft.name),
        )
      }
      setOpen(false)
      setDraft(null)
      setEditing(null)
    })
  }

  function removeContact(contact: LeadRelatedContact) {
    if (
      !window.confirm(`¿Retirar a ${contact.name} de los contactos relacionados con ${leadName}?`)
    )
      return
    startTransition(async () => {
      const result = await archiveLeadContact({ leadId, contactId: contact.id })
      if (!result.ok) {
        sileo.error({ title: result.error })
        return
      }
      sileo.success({ title: 'Contacto retirado de este lead' })
    })
  }

  return (
    <section
      id="contactos-relacionados"
      aria-label="Contactos relacionados"
      className="rounded-xl border bg-card shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Users className="size-4 text-primary" /> Contactos relacionados
            <Badge variant="secondary">{contacts.length}</Badge>
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Personas vinculadas a este lead, detectadas en Meet o añadidas desde una llamada.
          </p>
        </div>
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={() => beginCreate()}
          >
            <Plus className="size-4" /> Añadir contacto
          </Button>
        ) : null}
      </div>

      {canEdit && pendingSuggestions.length ? (
        <div className="border-b bg-primary/[0.035] px-4 py-4 sm:px-5">
          <div className="mb-3">
            <p className="text-xs font-semibold text-foreground">
              Personas detectadas en Google Meet
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Revisa cada sugerencia: solo se guardan las personas que elijas.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {pendingSuggestions.map((suggestion) => (
              <div
                key={suggestion.key}
                className="flex min-w-0 flex-col gap-3 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <UserRound className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{suggestion.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {suggestion.email || 'Email no disponible'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Reunión: {suggestion.meetingLabel}
                    </p>
                  </div>
                </div>
                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="min-h-11"
                    onClick={() => beginCreate(suggestion)}
                  >
                    Guardar contacto
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-h-11"
                    onClick={() => {
                      dismissedMeetSuggestions.add(suggestion.key)
                      setDismissed(new Set(dismissedMeetSuggestions))
                    }}
                  >
                    Descartar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="divide-y">
        {contacts.map((contact) => (
          <article
            key={contact.id}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:px-5"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserRound className="size-5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{contact.name}</p>
                  {contact.source === 'meet' ? <Badge variant="outline">Google Meet</Badge> : null}
                </div>
                {[contact.role, contact.company].filter(Boolean).length ? (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <BriefcaseBusiness className="size-3.5" />
                    {[contact.role, contact.company].filter(Boolean).join(' · ')}
                  </p>
                ) : null}
                {contact.source_interaction_id ? (
                  <Link
                    href={`/leads/${leadId}?tab=actividad#interaction-${contact.source_interaction_id}`}
                    className="mt-1 inline-flex min-h-8 items-center text-xs font-medium text-primary hover:underline"
                  >
                    Ver reunión de origen
                  </Link>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {contact.phone ? (
                    <a
                      href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}
                      className="inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-xs font-medium text-primary"
                    >
                      <Phone className="size-3.5" /> Llamar
                    </a>
                  ) : null}
                  {contact.phone ? (
                    <a
                      href={buildWhatsAppUrl(contact.phone, '')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                    >
                      <WhatsAppIcon className="size-3.5" /> WhatsApp
                    </a>
                  ) : null}
                  {contact.email ? (
                    <a
                      href={`mailto:${contact.email}`}
                      className="inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-xs font-medium text-primary"
                    >
                      <Mail className="size-3.5" /> Email
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => downloadRelatedContact(contact, leadId)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-xs font-medium text-primary"
                  >
                    <Contact className="size-3.5" /> Guardar en el móvil
                  </button>
                </div>
                {contact.notes ? (
                  <p className="mt-2 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                    {contact.notes}
                  </p>
                ) : null}
              </div>
            </div>
            {canEdit ? (
              <div className="flex shrink-0 gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-10"
                  onClick={() => beginEdit(contact)}
                >
                  Editar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-10 text-muted-foreground"
                  disabled={busy}
                  onClick={() => removeContact(contact)}
                >
                  Retirar
                </Button>
              </div>
            ) : null}
          </article>
        ))}
        {contacts.length === 0 && pendingSuggestions.length === 0 ? (
          <div className="px-4 py-7 text-center sm:px-5">
            <MessageCircle className="mx-auto size-5 text-muted-foreground/70" />
            <p className="mt-2 text-sm font-medium">Aún no hay contactos relacionados</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Los participantes de Meet aparecerán aquí para que decidas a quién guardar.
            </p>
          </div>
        ) : null}
      </div>

      {canEdit ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editing ? 'Editar contacto relacionado' : 'Guardar contacto del lead'}
              </DialogTitle>
              <DialogDescription>
                {draft?.sourceInteractionId
                  ? 'Revisa los datos de la persona detectada en Meet antes de guardarla.'
                  : 'Guarda la persona y su relación comercial con este lead.'}
              </DialogDescription>
            </DialogHeader>
            {draft ? (
              <form className="space-y-3" onSubmit={saveContact}>
                <div className="space-y-1">
                  <label htmlFor="related-contact-name" className="text-sm font-medium">
                    Nombre *
                  </label>
                  <Input
                    id="related-contact-name"
                    required
                    maxLength={160}
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label htmlFor="related-contact-email" className="text-sm font-medium">
                      Email
                    </label>
                    <Input
                      id="related-contact-email"
                      type="email"
                      inputMode="email"
                      maxLength={254}
                      value={draft.email}
                      onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="related-contact-phone" className="text-sm font-medium">
                      Teléfono
                    </label>
                    <Input
                      id="related-contact-phone"
                      type="tel"
                      inputMode="tel"
                      maxLength={40}
                      value={draft.phone}
                      onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label htmlFor="related-contact-role" className="text-sm font-medium">
                      Cargo o relación
                    </label>
                    <Input
                      id="related-contact-role"
                      maxLength={120}
                      placeholder="Dirección, compras…"
                      value={draft.role}
                      onChange={(event) => setDraft({ ...draft, role: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="related-contact-company" className="text-sm font-medium">
                      Empresa
                    </label>
                    <Input
                      id="related-contact-company"
                      maxLength={160}
                      value={draft.company}
                      onChange={(event) => setDraft({ ...draft, company: event.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label htmlFor="related-contact-notes" className="text-sm font-medium">
                    Contexto comercial
                  </label>
                  <Textarea
                    id="related-contact-notes"
                    maxLength={2000}
                    rows={3}
                    placeholder="Qué decide, qué necesita o cómo se relaciona con la oportunidad…"
                    value={draft.notes}
                    onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                  />
                </div>
                <div className="flex flex-col-reverse justify-end gap-2 pt-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => setOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="min-h-11" disabled={busy}>
                    {busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Añadir al lead'}
                  </Button>
                </div>
              </form>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  )
}
