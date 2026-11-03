'use client'

import { ChevronDown, QrCode } from 'lucide-react'
import Image from 'next/image'

import type { CallBriefing } from '@/lib/leads/call-briefing'

const GENERAL_QUESTIONS = [
  '¿Qué problema os gustaría resolver y cómo lo estáis resolviendo ahora?',
  '¿Qué plazo tenéis y qué presupuesto estáis valorando?',
  '¿Quién participa en la decisión y qué necesitáis para avanzar?',
  '¿Qué siguiente paso os encajaría después de esta conversación?',
]

export function CallWorkspaceQuestions({
  questions,
  qr,
  qrError,
  canCall,
}: {
  questions: CallBriefing['questions']
  qr: string | null
  qrError: boolean
  canCall: boolean
}) {
  const prepared = questions.length > 0
  const items: CallBriefing['questions'] = prepared
    ? questions
    : GENERAL_QUESTIONS.map((question) => ({ question, status: 'open' }))
  return (
    <div className="space-y-5">
      {canCall ? (
        <details className="group rounded-xl border border-border/60 bg-card">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <QrCode className="size-4 text-muted-foreground" aria-hidden />
            Llamar desde el móvil
            <ChevronDown
              className="ml-auto size-4 text-muted-foreground group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="flex flex-col items-center gap-3 border-t border-border/60 p-4">
            {qr ? (
              <Image
                src={qr}
                alt="QR para continuar la llamada desde el móvil"
                width={180}
                height={180}
                unoptimized
                className="rounded-lg bg-white p-1"
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                {qrError
                  ? 'No se pudo generar el QR. Puedes llamar desde este dispositivo.'
                  : 'Generando QR…'}
              </p>
            )}
            <p className="max-w-xs text-center text-xs leading-5 text-muted-foreground">
              Escanea el QR para abrir el teléfono móvil. El seguimiento continúa aquí.
            </p>
          </div>
        </details>
      ) : null}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">
          {prepared ? 'Preguntas pendientes del lead' : 'Guía general para la llamada'}
        </h3>
        <p className="text-xs leading-5 text-muted-foreground">
          {prepared
            ? 'Un guion de apoyo, no un cuestionario. Prioriza lo que aún necesites aclarar.'
            : 'No hay preguntas preparadas para este lead. Estas preguntas son generales, no acuerdos registrados.'}
        </p>
      </div>
      <ol className="space-y-3">
        {items.map((item, index) => (
          <li
            key={`${item.question}-${index}`}
            className="flex gap-3 rounded-xl border border-border/60 bg-card p-3"
          >
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-xs font-medium text-primary"
              aria-hidden
            >
              {index + 1}
            </span>
            <div className="min-w-0 space-y-1.5">
              <p className="text-sm leading-relaxed">{item.question}</p>
              {item.status === 'needs_review' ? (
                <p className="text-xs font-medium text-muted-foreground">Respuesta por confirmar</p>
              ) : null}
              {item.rationale ? (
                <p className="text-xs leading-5 text-muted-foreground">{item.rationale}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <p className="text-xs leading-5 text-muted-foreground">
        Al terminar podrás registrar el resultado, las notas y los próximos pasos.
      </p>
    </div>
  )
}
