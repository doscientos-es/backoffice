'use client'

import { ArrowUp, Info, LoaderCircle } from 'lucide-react'
import { type FormEvent, type RefObject, useId } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type ComposerProps = {
  question: string
  loading: boolean
  error: string | null
  inputRef: RefObject<HTMLTextAreaElement | null>
  onQuestionChange: (question: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function LeadAssistantComposer({
  question,
  loading,
  error,
  inputRef,
  onQuestionChange,
  onSubmit,
}: ComposerProps) {
  const inputId = useId()
  const hintId = useId()

  return (
    <div className="shrink-0 border-t border-border/60 bg-card px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
      {error ? (
        <div
          role="alert"
          className="mb-3 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      ) : null}
      <form
        onSubmit={onSubmit}
        aria-label="Consultar el historial del lead"
        className="rounded-2xl border border-border bg-background p-3 shadow-xs focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10"
      >
        <label htmlFor={inputId} className="sr-only">
          Pregunta sobre el lead
        </label>
        <Textarea
          id={inputId}
          ref={inputRef}
          placeholder="¿Qué te gustaría saber de este lead?"
          aria-describedby={hintId}
          aria-keyshortcuts="Control+Enter Meta+Enter"
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              (event.ctrlKey || event.metaKey) &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
          maxLength={2000}
          rows={2}
          disabled={loading}
          className="max-h-44 min-h-20 resize-none border-0 bg-transparent p-1 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span id={hintId} className="text-xs text-muted-foreground">
            <span className="hidden sm:inline">Ctrl / ⌘ + Intro para consultar</span>
            <span className="sm:hidden">Hasta 2000 caracteres</span>
          </span>
          <div className="flex items-center gap-3">
            {question.length > 1600 ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                {question.length}/2000
              </span>
            ) : null}
            <Button
              type="submit"
              disabled={loading || !question.trim()}
              className="min-h-11 gap-2 rounded-xl px-4 motion-reduce:transform-none motion-reduce:transition-none sm:min-h-10"
            >
              Consultar
              {loading ? (
                <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />
              ) : (
                <ArrowUp className="size-4" aria-hidden />
              )}
            </Button>
          </div>
        </div>
      </form>
      <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
        La IA puede equivocarse. La conversación se pierde al salir de la ficha.
      </p>
    </div>
  )
}
