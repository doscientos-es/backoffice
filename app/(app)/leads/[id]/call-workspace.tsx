'use client'

import { Drawer, DrawerDescription, DrawerHeader, DrawerTitle } from '@doscientos/ui'
import { CheckCircle2, FileText, Phone, PhoneOff, Sparkles } from 'lucide-react'
import { Tabs } from 'radix-ui'
import { useCallback, useEffect, useRef, useState } from 'react'

import { CallBriefingCard } from '@/components/leads/call-briefing-card'
import { Button } from '@/components/ui/button'
import type { CallWorkspaceData } from '@/lib/leads/call-briefing'

import { getLeadCallBriefing } from './call-workspace-actions'
import { CallWorkspaceQuestions } from './call-workspace-questions'
import { LeadAssistantConversation } from './lead-assistant'

type Props = {
  leadId: string
  phone: string
  status: string
  pending: boolean
  error: string | null
  qr: string | null
  qrError: boolean
  completion: { durationMinutes: number; defaultOutcome: 'connected' | 'no_answer' } | null
  onOpenChange: (open: boolean) => void
  onCall: () => void
  onFinish: () => void
  onRegister: () => void
}

export function CallWorkspace({
  leadId,
  phone,
  status,
  pending,
  error,
  qr,
  qrError,
  completion,
  onOpenChange,
  onCall,
  onFinish,
  onRegister,
}: Props) {
  const [data, setData] = useState<CallWorkspaceData | null>(null)
  const [contextError, setContextError] = useState<string | null>(null)
  const [tab, setTab] = useState('questions')
  const request = useRef(0)
  const loadContext = useCallback(async () => {
    const requestId = ++request.current
    setData(null)
    setContextError(null)
    try {
      const result = await getLeadCallBriefing({ leadId })
      if (requestId !== request.current) return
      if (!result.ok) {
        setContextError(result.error)
        return
      }
      setData({ briefing: result.briefing, aiEnabled: result.aiEnabled })
    } catch {
      if (requestId === request.current) setContextError('No se pudo cargar el contexto del lead.')
    }
  }, [leadId])
  useEffect(() => {
    setTab('questions')
    void loadContext()
    return () => {
      request.current += 1
    }
  }, [loadContext])
  const canCall = status === 'started' || status === 'dialing'

  return (
    <Drawer
      isOpen
      onOpenChange={onOpenChange}
      className="gap-0 overflow-hidden bg-background data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
    >
      <div className="flex h-full min-h-0 flex-col">
        <DrawerHeader className="shrink-0 gap-2 border-b border-border/60 bg-card px-4 py-4 pr-12">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Phone className="size-4" aria-hidden />
            </span>
            <DrawerTitle>Durante la llamada</DrawerTitle>
          </div>
          <DrawerDescription className="block text-xs">
            <span className="font-medium text-foreground">{data?.briefing.name || phone}</span>
            {data ? <span> · {phone}</span> : null}
            {data?.briefing.company ? <span> · {data.briefing.company}</span> : null}
          </DrawerDescription>
        </DrawerHeader>
        <div className="max-h-[28svh] shrink-0 overflow-y-auto border-b border-border/60 bg-card px-4 py-3">
          {data ? (
            <CallBriefingCard briefing={data.briefing} compact />
          ) : contextError ? (
            <div className="space-y-2">
              <p role="alert" className="text-sm text-destructive">
                {contextError}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadContext()}>
                Reintentar contexto
              </Button>
            </div>
          ) : (
            <p role="status" className="text-xs text-muted-foreground">
              Cargando contexto del lead…
            </p>
          )}
        </div>
        <Tabs.Root value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <Tabs.List
            aria-label="Herramientas durante la llamada"
            className="flex shrink-0 gap-1 border-b border-border/60 bg-card px-4"
          >
            <Tabs.Trigger
              value="questions"
              className="flex min-h-11 items-center gap-2 border-b-2 border-transparent px-3 text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:border-primary data-[state=active]:text-foreground"
            >
              <FileText className="size-4" aria-hidden />
              Preguntas
            </Tabs.Trigger>
            <Tabs.Trigger
              value="assistant"
              disabled={!data?.aiEnabled}
              className="flex min-h-11 items-center gap-2 border-b-2 border-transparent px-3 text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 data-[state=active]:border-primary data-[state=active]:text-foreground"
            >
              <Sparkles className="size-4" aria-hidden />
              Asistente
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content
            value="questions"
            forceMount
            hidden={tab !== 'questions'}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 outline-none data-[state=inactive]:hidden"
          >
            <CallWorkspaceQuestions
              questions={data?.briefing.questions ?? []}
              qr={qr}
              qrError={qrError}
              canCall={canCall}
            />
            {data && !data.aiEnabled ? (
              <p className="mt-4 text-xs text-muted-foreground">
                El asistente IA no está disponible. Puedes usar el resumen y el guion.
              </p>
            ) : null}
          </Tabs.Content>
          <Tabs.Content
            value="assistant"
            forceMount
            hidden={tab !== 'assistant'}
            className="flex min-h-0 flex-1 flex-col outline-none data-[state=inactive]:hidden"
          >
            {data?.aiEnabled ? (
              <LeadAssistantConversation key={leadId} leadId={leadId} duringCall />
            ) : null}
          </Tabs.Content>
        </Tabs.Root>
        <div className="shrink-0 space-y-2 border-t border-border/60 bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {status === 'logged' ? (
            <p className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="size-4 text-success" aria-hidden />
              Resultado ya registrado
            </p>
          ) : status === 'awaiting_log' ? (
            <>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="size-4 text-success" aria-hidden />
                Llamada finalizada
                {completion ? ` · ${completion.durationMinutes} min estimados` : ''}
              </p>
              <Button type="button" onClick={onRegister} className="min-h-11 w-full">
                Registrar resultado
              </Button>
            </>
          ) : canCall ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCall}
                  disabled={pending}
                  className="min-h-11 gap-2"
                >
                  <Phone className="size-4" aria-hidden />
                  Llamar aquí
                </Button>
                <Button
                  type="button"
                  onClick={onFinish}
                  disabled={pending}
                  className="min-h-11 gap-2"
                >
                  <PhoneOff className="size-4" aria-hidden />
                  Terminar
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Duración estimada. Confirma el resultado y las notas al terminar.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Esta sesión de llamada está cerrada.</p>
          )}
        </div>
      </div>
    </Drawer>
  )
}
