import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { BackLink } from '@/components/layout/back-link'
import { PageHeader } from '@/components/layout/page-header'
import { requirePageRole } from '@/lib/auth'
import { getPost } from '@/lib/social/repo'

import { ScheduledPostMediaForm } from './scheduled-post-media-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Cambiar imagen · Social' }

export default async function EditScheduledPostMediaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePageRole(['owner', 'admin', 'member'])
  const { id } = await params
  const post = await getPost(id)
  if (!post) notFound()
  if (post.status !== 'scheduled') redirect(`/social/${id}`)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cambiar imagen"
        description="Sustituye la imagen antes de que se publique."
        back={<BackLink href={`/social/${id}`} label="Volver al detalle" />}
      />
      <ScheduledPostMediaForm postId={post.id} initialMedia={post.media} />
    </div>
  )
}
