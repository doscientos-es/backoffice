import { CheckCircle2, Download } from 'lucide-react'
import { notFound } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { loadNdaByToken } from '@/lib/nda/load'

import { SignNdaForm } from './sign-form'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Acuerdo de confidencialidad · doscientos' }

export default async function NdaPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const nda = await loadNdaByToken(token)
  if (!nda) notFound()
  const { document } = nda
  const signed = nda.status === 'signed'

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{document.title}</h1>
        <Button asChild variant="outline" size="sm">
          <a href={`/p/nda/${token}/pdf`}>
            <Download aria-hidden /> Descargar PDF
          </a>
        </Button>
      </header>

      <div className="flex flex-col gap-3 text-sm leading-6">
        {document.intro.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {document.clauses.map((clause) => (
          <section key={clause.title}>
            <h2 className="font-semibold">{clause.title}</h2>
            <p>{clause.body}</p>
          </section>
        ))}
      </div>

      <section className="rounded-xl border p-4">
        {signed ? (
          <p className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
            Firmado por <strong>{nda.signedName}</strong>
            {nda.signedAt ? ` el ${new Date(nda.signedAt).toLocaleDateString('es-ES')}` : ''}.
          </p>
        ) : (
          <SignNdaForm token={token} />
        )}
      </section>
    </article>
  )
}
