'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  SubmitButton,
} from '@doscientos/ui'
import { Plus, Trash2, Upload } from 'lucide-react'
import { type FormEvent, useState, useTransition } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import {
  createEmailMarketingList,
  createEmailMarketingSequence,
  deleteEmailMarketingList,
  importEmailMarketingContacts,
} from './actions'

type ListRef = { id: string; name: string; contact_count?: number }
type Action = (input: FormData) => Promise<{ ok: boolean; error?: string }>

/** Runs a server action from a dialog form: pending state, toast and close on success. */
function useDialogForm(action: Action, onDone: () => void, success: (res: never) => string) {
  const [pending, startTransition] = useTransition()
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    startTransition(async () => {
      const res = await action(data)
      if (!res.ok) return void sileo.error({ title: res.error ?? 'No se pudo completar la acción' })
      sileo.success({ title: success(res as never) })
      form.reset()
      onDone()
    })
  }
  return { pending, submit }
}

export function CreateListDialog() {
  const [open, setOpen] = useState(false)
  const { pending, submit } = useDialogForm(
    createEmailMarketingList,
    () => setOpen(false),
    () => 'Lista creada',
  )
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden="true" /> Nueva lista
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva lista</DialogTitle>
            <DialogDescription>
              Agrupa contactos para enviarles secuencias de emails.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="list-name">Nombre</Label>
              <Input
                id="list-name"
                name="name"
                required
                minLength={2}
                maxLength={120}
                placeholder="Agencias para colaboración"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="list-description">Descripción (opcional)</Label>
              <Input
                id="list-description"
                name="description"
                maxLength={500}
                placeholder="Agencias de marketing y SEO"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <SubmitButton loading={pending} loadingLabel="Creando…">
                Crear lista
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function ImportContactsDialog({ list }: { list: ListRef }) {
  const [open, setOpen] = useState(false)
  const { pending, submit } = useDialogForm(
    importEmailMarketingContacts,
    () => setOpen(false),
    (res: { addedToList?: number; suppressed?: number }) =>
      `${res.addedToList ?? 0} contactos en la lista${res.suppressed ? ` · ${res.suppressed} omitidos por baja` : ''}`,
  )
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Upload className="size-3.5" aria-hidden="true" /> Añadir contactos
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Añadir contactos a «{list.name}»</DialogTitle>
            <DialogDescription>
              Pega emails o CSV con email, nombre, empresa y, opcionalmente, origen y referencia del
              permiso. Los contactos dados de baja no se reactivan.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4">
            <input type="hidden" name="listId" value={list.id} />
            <div className="grid gap-1.5">
              <Label htmlFor={`consent-source-${list.id}`}>Origen del permiso</Label>
              <Input
                id={`consent-source-${list.id}`}
                name="consentSource"
                required
                minLength={3}
                maxLength={200}
                placeholder="Formulario web, evento, solicitud…"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`contact-csv-${list.id}`}>Emails o CSV</Label>
              <Textarea
                id={`contact-csv-${list.id}`}
                name="csv"
                required
                maxLength={2000000}
                className="min-h-40 font-mono text-xs"
                placeholder={
                  'email,nombre,empresa,consent_source,consent_reference\nana@empresa.es,Ana,Empresa,Formulario web,registro-123'
                }
              />
            </div>
            <label className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <input
                type="checkbox"
                name="confirmPermission"
                required
                className="mt-1 size-4 rounded border-border"
              />
              <span>
                Confirmo que las personas importadas han autorizado recibir estos emails y que el
                origen indicado es correcto.
              </span>
            </label>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <SubmitButton loading={pending} loadingLabel="Importando…">
                Añadir a la lista
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function DeleteListDialog({ list }: { list: ListRef }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const confirm = () =>
    startTransition(async () => {
      const res = await deleteEmailMarketingList({ id: list.id })
      if (!res.ok) return void sileo.error({ title: res.error })
      sileo.success({ title: 'Lista eliminada' })
      setOpen(false)
    })
  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Eliminar lista ${list.name}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar «{list.name}»?</DialogTitle>
            <DialogDescription>
              Dejará de aparecer en el backoffice. Los contactos no se borran.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={pending} onClick={confirm}>
              {pending ? 'Eliminando…' : 'Eliminar lista'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function CreateSequenceDialog({ lists }: { lists: ListRef[] }) {
  const [open, setOpen] = useState(false)
  const { pending, submit } = useDialogForm(
    createEmailMarketingSequence,
    () => setOpen(false),
    () => 'Secuencia creada',
  )
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden="true" /> Nueva secuencia
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva secuencia</DialogTitle>
            <DialogDescription>
              Asocia una lista y luego añade los emails con sus fechas de envío.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="sequence-name">Nombre de la secuencia</Label>
              <Input
                id="sequence-name"
                name="name"
                required
                minLength={2}
                maxLength={160}
                placeholder="Empresas interesadas en desarrollo"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sequence-list">Lista de contactos</Label>
              <select
                id="sequence-list"
                name="listId"
                required
                disabled={lists.length === 0}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
              >
                {lists.length === 0 ? (
                  <option value="">Primero crea una lista</option>
                ) : (
                  lists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name} ({list.contact_count ?? 0})
                    </option>
                  ))
                )}
              </select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <SubmitButton
                loading={pending}
                loadingLabel="Creando…"
                isDisabled={lists.length === 0}
              >
                Crear secuencia
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
