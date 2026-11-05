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
import { Pencil, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type {
  EmailMarketingContact,
  EmailMarketingList,
  EmailMarketingSequence,
} from '@/lib/marketing/email-marketing'

import {
  deleteEmailMarketingSequence,
  removeEmailMarketingContact,
  updateEmailMarketingContact,
  updateEmailMarketingList,
  updateEmailMarketingSequence,
} from './actions'
import { useDialogForm } from './list-dialogs'

type EditTarget =
  | { kind: 'list'; value: EmailMarketingList }
  | { kind: 'sequence'; value: EmailMarketingSequence }
  | { kind: 'contact'; value: EmailMarketingContact }

export function EditMarketingDialog({ target }: { target: EditTarget }) {
  const [open, setOpen] = useState(false)
  const action =
    target.kind === 'list'
      ? updateEmailMarketingList
      : target.kind === 'sequence'
        ? updateEmailMarketingSequence
        : updateEmailMarketingContact
  const { pending, submit } = useDialogForm(
    action,
    () => setOpen(false),
    () => 'Cambios guardados',
  )
  const label =
    target.kind === 'list' ? 'lista' : target.kind === 'sequence' ? 'secuencia' : 'contacto'
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="size-4" /> Editar
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {label}</DialogTitle>
            <DialogDescription>
              {target.kind === 'contact'
                ? 'Los cambios se aplican al contacto en todas sus listas. El email y su estado de consentimiento no cambian.'
                : `Actualiza los datos de la ${label}.`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4">
            <input type="hidden" name="id" value={target.value.id} />
            <div className="grid gap-1.5">
              <Label htmlFor={`edit-name-${target.value.id}`}>
                Nombre{target.kind === 'contact' ? ' (opcional)' : ''}
              </Label>
              <Input
                id={`edit-name-${target.value.id}`}
                name="name"
                defaultValue={target.value.name ?? ''}
                required={target.kind !== 'contact'}
                minLength={target.kind === 'contact' ? undefined : 2}
                maxLength={target.kind === 'list' ? 120 : target.kind === 'sequence' ? 160 : 200}
              />
            </div>
            {target.kind === 'list' && (
              <div className="grid gap-1.5">
                <Label htmlFor={`edit-description-${target.value.id}`}>Descripción</Label>
                <Input
                  id={`edit-description-${target.value.id}`}
                  name="description"
                  maxLength={500}
                  defaultValue={target.value.description ?? ''}
                />
              </div>
            )}
            {target.kind === 'contact' && (
              <div className="grid gap-1.5">
                <Label htmlFor={`edit-company-${target.value.id}`}>Empresa</Label>
                <Input
                  id={`edit-company-${target.value.id}`}
                  name="company"
                  maxLength={200}
                  defaultValue={target.value.company ?? ''}
                />
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <SubmitButton loading={pending} loadingLabel="Guardando…">
                Guardar cambios
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function DeleteSequenceDialog({ sequence }: { sequence: EmailMarketingSequence }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const confirm = () =>
    startTransition(async () => {
      const result = await deleteEmailMarketingSequence({ id: sequence.id })
      if (!result.ok) return void sileo.error({ title: result.error })
      sileo.success({ title: 'Secuencia eliminada' })
      setOpen(false)
      router.push(`/marketing/newsletters?list=${sequence.list_id}`)
    })
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" /> Eliminar
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar «{sequence.name}»?</DialogTitle>
            <DialogDescription>
              La secuencia dejará de aparecer y se conserva el historial. Debe estar pausada y sin
              envíos en curso; los envíos ya iniciados pueden necesitar terminar antes de
              eliminarla.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={pending} onClick={confirm}>
              {pending ? 'Eliminando…' : 'Eliminar secuencia'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function RemoveContactDialog({
  listId,
  contact,
}: {
  listId: string
  contact: EmailMarketingContact
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const confirm = () =>
    startTransition(async () => {
      const result = await removeEmailMarketingContact({ listId, contactId: contact.id })
      if (!result.ok) return void sileo.error({ title: result.error })
      sileo.success({ title: 'Contacto retirado de la lista' })
      setOpen(false)
    })
  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Retirar ${contact.email} de la lista`}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Retirar a {contact.email}?</DialogTitle>
            <DialogDescription>
              Se retirará solo de esta lista, sin borrar el contacto ni modificar su consentimiento.
              Los envíos que ya estén en cola no se cancelarán.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={pending} onClick={confirm}>
              {pending ? 'Retirando…' : 'Retirar contacto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
