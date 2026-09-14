import { CalendarDays } from 'lucide-react'
import type { Metadata } from 'next'

import {
  AccountsReceivableSkeleton,
  AccountsReceivableWidget,
} from '@/components/finance/accounts-receivable-card'
import {
  MonthExpensesSkeleton,
  MonthExpensesWidget,
} from '@/components/finance/month-expenses-card'
import { PasskeyStatusCard } from '@/components/security/passkey-status-card'
import { SectionBoundary } from '@/components/ui/error-boundary'
import { canViewFinance, requireUser } from '@/lib/auth'
import { hasRegisteredPasskey } from '@/lib/security/webauthn'
import { getGreeting, parseDashboardRange } from '@/lib/utils/date'

import { AvisosWidget } from './_components/avisos-widget'
import { EnablePushBanner } from './_components/enable-push-banner'
import { KpiGrid } from './_components/kpi-grid'
import { getMyDayScope } from './_components/my-day-scope'
import { MyDayScopeSelector } from './_components/my-day-scope-selector'
import { MyDayWidget } from './_components/my-day-widget'
import { RangeSelector } from './_components/range-selector'
import { RevenueWidget } from './_components/revenue-widget'
import {
  AvisosWidgetSkeleton,
  KpiGridSkeleton,
  MyDayWidgetSkeleton,
  RangeSelectorSkeleton,
  RevenueWidgetSkeleton,
} from './_components/widget-skeletons'
import { ActionCenterWidget } from './action-center-widget'

export const metadata: Metadata = { title: 'Inicio · doscientos' }
export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{ range?: string | string[]; member?: string | string[] }>
}

export default async function InicioPage({ searchParams }: PageProps) {
  const [user, params] = await Promise.all([requireUser(), searchParams])
  const [passkeyConfigured, myDayScope] = await Promise.all([
    hasRegisteredPasskey(user.id),
    getMyDayScope({ user, member: params.member }),
  ])
  const range = parseDashboardRange(params.range)
  const greeting = getGreeting()
  const firstName = user.name.split(' ')[0]
  const showFinance = canViewFinance(user.role)
  const today = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  return (
    <div className="flex flex-col gap-10 pb-4">
      <header className="relative overflow-hidden">
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {greeting}, {firstName}
            </h1>
            <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-6">
              Empieza por lo urgente y mantén el pulso del negocio en una sola vista.
            </p>
          </div>
          <div className="border-border/70 bg-background/70 text-muted-foreground inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm">
            <CalendarDays aria-hidden="true" className="text-primary size-3.5" />
            <span className="capitalize">{today}</span>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        <EnablePushBanner />
        {!passkeyConfigured ? (
          <PasskeyStatusCard configured={false} setupHref="/settings/security" />
        ) : null}
      </div>

      <section className="flex flex-col gap-5" aria-labelledby="inicio-prioridades">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="inicio-prioridades" className="mt-1 text-xl font-semibold tracking-tight">
              Prioridades para avanzar
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Tareas, conversaciones y avisos que no conviene dejar pasar.
            </p>
          </div>
          {myDayScope.canViewTeam ? <MyDayScopeSelector scope={myDayScope} /> : null}
        </div>

        <SectionBoundary pending={<MyDayWidgetSkeleton />} label="No se pudo cargar tu día">
          <MyDayWidget userId={user.id} scope={myDayScope} />
        </SectionBoundary>
        <SectionBoundary
          pending={<AvisosWidgetSkeleton />}
          label="No se pudieron cargar los avisos"
        >
          <AvisosWidget showFinance={showFinance} />
        </SectionBoundary>
        <SectionBoundary pending={null} label="No se pudieron cargar las acciones">
          <ActionCenterWidget />
        </SectionBoundary>
      </section>

      <section className="flex flex-col gap-5" aria-labelledby="inicio-negocio">
        <div className="relative flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <header>
              <h2 id="inicio-negocio" className="mt-1 text-xl font-semibold tracking-tight">
                La salud del negocio
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Una lectura clara de la actividad comercial y financiera.
              </p>
            </header>
            <SectionBoundary
              pending={<RangeSelectorSkeleton />}
              label="No se pudo cargar el selector"
            >
              <RangeSelector current={range} />
            </SectionBoundary>
          </div>

          <SectionBoundary
            key={range}
            pending={<KpiGridSkeleton />}
            label="No se pudieron cargar los KPIs"
          >
            <KpiGrid range={range} showFinance={showFinance} />
          </SectionBoundary>

          {showFinance ? (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <SectionBoundary
                  pending={<AccountsReceivableSkeleton />}
                  label="No se pudo cargar el cobro pendiente"
                >
                  <AccountsReceivableWidget />
                </SectionBoundary>
                <SectionBoundary
                  pending={<MonthExpensesSkeleton />}
                  label="No se pudo cargar el gasto del mes"
                >
                  <MonthExpensesWidget />
                </SectionBoundary>
              </div>

              <SectionBoundary
                pending={<RevenueWidgetSkeleton />}
                label="No se pudieron cargar los ingresos"
              >
                <RevenueWidget range={range} />
              </SectionBoundary>
            </>
          ) : null}
        </div>
      </section>
    </div>
  )
}
