'use client'

import { ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Input } from '@/components/ui/input'

import { linkProjectRepository } from '../repository-actions'

export function RepositoryLinkPanel({
  projectId,
  version,
  repository,
  syncMode,
  canEdit,
}: {
  projectId: string
  version: number
  repository: string | null
  syncMode: string
  canEdit: boolean
}) {
  const router = useRouter()
  const feedback = useFormFeedback()
  const [editing, setEditing] = useState(!repository && canEdit)
  const [value, setValue] = useState(repository ?? '')
  const [repos, setRepos] = useState<Array<{ name: string; html_url: string }>>([])
  const prefix = `repository-${projectId}`

  useEffect(() => {
    if (!editing || !canEdit) return
    const controller = new AbortController()
    void fetch('/api/github/repos', { signal: controller.signal })
      .then(async (response) =>
        response.ok ? (response.json() as Promise<{ repos?: typeof repos }>) : null,
      )
      .then((result) => {
        if (!controller.signal.aborted) setRepos(result?.repos ?? [])
      })
      .catch(() => {
        /* A pasted URL always works without GitHub App access. */
      })
    return () => controller.abort()
  }, [editing, canEdit])

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    feedback.setPending()
    const result = await linkProjectRepository({
      projectId,
      expectedVersion: version,
      repository: value,
    })
    if (!result.ok) {
      feedback.setError(result.error)
      if (result.code === 'conflict') router.refresh()
      return
    }
    feedback.setSuccess('Repositorio enlazado')
    setEditing(false)
    router.refresh()
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {repository ? (
          <a
            href={repository}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-w-0 items-center gap-2 rounded text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            <span className="break-all">{repository.replace('https://github.com/', '')}</span>
            <ExternalLink className="size-4 shrink-0" aria-hidden />
            <span className="sr-only">(abre GitHub en otra pestaña)</span>
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">Sin repositorio enlazado.</p>
        )}
        {canEdit && repository && syncMode !== 'bidirectional' && !editing ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            Cambiar enlace
          </Button>
        ) : null}
      </div>
      <p id={`${prefix}-help`} className="text-xs text-muted-foreground">
        {syncMode === 'bidirectional'
          ? 'Sincronización activa. Para cambiar el repositorio, usa Editar proyecto.'
          : 'Solo un enlace: no crea issues, ramas ni activa la sincronización con GitHub.'}
      </p>
      {editing && canEdit && syncMode !== 'bidirectional' ? (
        <form
          aria-label="Enlazar repositorio de GitHub"
          onSubmit={(event) => void save(event)}
          className="grid gap-3"
        >
          <div className="grid gap-1.5">
            <label htmlFor={prefix} className="text-sm font-medium">
              URL del repositorio de GitHub
            </label>
            <Input
              id={prefix}
              type="url"
              required
              maxLength={500}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              list={`${prefix}-suggestions`}
              aria-describedby={`${prefix}-help`}
              placeholder="https://github.com/organizacion/repositorio"
            />
            <datalist id={`${prefix}-suggestions`}>
              {repos.map((repo) => (
                <option key={repo.html_url} value={repo.html_url}>
                  {repo.name}
                </option>
              ))}
            </datalist>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={feedback.pending || !value.trim()}>
              {feedback.pending ? 'Guardando…' : 'Enlazar repositorio'}
            </Button>
            {repository ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={feedback.pending}
                onClick={() => {
                  setValue(repository)
                  setEditing(false)
                }}
              >
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}
      <FormFeedback state={feedback.state} />
    </div>
  )
}
