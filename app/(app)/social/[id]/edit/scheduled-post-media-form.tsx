'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { FormRow } from '@/components/ui/form-row'
import { SubmitButton } from '@/components/ui/submit-button'
import type { MediaItem } from '@/lib/social/core'

import { updateScheduledPostMedia } from '../../actions'
import { MediaPicker } from '../../compose/_components/media-picker'

export function ScheduledPostMediaForm({
  postId,
  initialMedia,
}: {
  postId: string
  initialMedia: MediaItem[]
}) {
  const router = useRouter()
  const feedback = useFormFeedback()
  const [pending, startTransition] = useTransition()
  const [media, setMedia] = useState(initialMedia)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    feedback.setPending()
    startTransition(async () => {
      const result = await updateScheduledPostMedia({ postId, media })
      if (!result.ok) return feedback.setError(result.error)
      router.push(`/social/${postId}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-6">
          <FormRow label="Imagen" htmlFor="media" hint="Imágenes o vídeo. Máximo 10 archivos.">
            <div id="media">
              <MediaPicker value={media} onChange={setMedia} disabled={pending} />
            </div>
          </FormRow>
        </CardContent>
      </Card>
      <div className="border-border flex items-center justify-end gap-3 border-t pt-4">
        <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
        <Button asChild variant="ghost" size="sm">
          <Link href={`/social/${postId}`}>Cancelar</Link>
        </Button>
        <SubmitButton loading={pending} pendingLabel="Guardando…">
          Guardar imagen
        </SubmitButton>
      </div>
    </form>
  )
}
