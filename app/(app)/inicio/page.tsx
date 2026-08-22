import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import {
  AccountsReceivableSkeleton,
  AccountsReceivableWidget,
} from "@/components/finance/accounts-receivable-card";
import {
  MonthExpensesSkeleton,
  MonthExpensesWidget,
} from "@/components/finance/month-expenses-card";
import { PasskeyStatusCard } from "@/components/security/passkey-status-card";
import { SectionBoundary } from "@/components/ui/error-boundary";
import { canViewFinance, requireUser } from "@/lib/auth";
import { hasRegisteredPasskey } from "@/lib/security/webauthn";
import { getGreeting, parseDashboardRange } from "@/lib/utils/date";
import { AvisosWidget } from "./_components/avisos-widget";
import { EnablePushBanner } from "./_components/enable-push-banner";
import { KpiGrid } from "./_components/kpi-grid";
import { MoneyOpportunitiesWidget } from "./_components/money-opportunities-widget";
import { MyDayWidget } from "./_components/my-day-widget";
import { RangeSelector } from "./_components/range-selector";
import { RevenueWidget } from "./_components/revenue-widget";
import { SalesControlWidget } from "./_components/sales-control-widget";
import {
  AvisosWidgetSkeleton,
  KpiGridSkeleton,
  MoneyOpportunitiesWidgetSkeleton,
  MyDayWidgetSkeleton,
  RangeSelectorSkeleton,
  RevenueWidgetSkeleton,
} from "./_components/widget-skeletons";

export const metadata: Metadata = { title: "Inicio · doscientos" };
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ range?: string | string[]; member?: string | string[] }>;
};

export default async function InicioPage({ searchParams }: PageProps) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const passkeyConfigured = await hasRegisteredPasskey(user.id);
  const range = parseDashboardRange(params.range);
  const greeting = getGreeting();
  const firstName = user.name.split(" ")[0];
  const showFinance = canViewFinance(user.role);
  const showSalesControl = user.role === "owner" || user.role === "admin";
  const today = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="flex flex-col gap-10 pb-4">
      <header className="relative overflow-hidden">
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {greeting}, {firstName}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Empieza por lo urgente y mantén el pulso del negocio en una sola vista.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
            <CalendarDays aria-hidden="true" className="size-3.5 text-primary" />
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
            <p className="mt-1 text-sm text-muted-foreground">
              Tareas, conversaciones y avisos que no conviene dejar pasar.
            </p>
          </div>
        </div>

        <SectionBoundary pending={<MyDayWidgetSkeleton />} label="No se pudo cargar tu día">
          <MyDayWidget member={params.member} />
        </SectionBoundary>
        <SectionBoundary
          pending={<AvisosWidgetSkeleton />}
          label="No se pudieron cargar los avisos"
        >
          <AvisosWidget showFinance={showFinance} />
        </SectionBoundary>
      </section>

      {showSalesControl ? <SalesControlWidget /> : null}

      <section className="flex flex-col gap-4" aria-labelledby="inicio-oportunidades">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">
            Crecimiento
          </p>
          <h2 id="inicio-oportunidades" className="mt-1 text-xl font-semibold tracking-tight">
            Oportunidades que merecen seguimiento
          </h2>
        </div>
        <SectionBoundary
          pending={<MoneyOpportunitiesWidgetSkeleton />}
          label="No se pudieron cargar las oportunidades"
        >
          <MoneyOpportunitiesWidget />
        </SectionBoundary>
      </section>

      <section
        className="relative overflow-hidden rounded-2xl border border-border bg-muted/30 p-4 sm:p-5 md:p-6"
        aria-labelledby="inicio-negocio"
      >
        <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-primary/8 blur-3xl" />
        <div className="relative flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Visión general
              </p>
              <h2 id="inicio-negocio" className="mt-1 text-xl font-semibold tracking-tight">
                La salud del negocio
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Una lectura clara de la actividad comercial y financiera.
              </p>
            </div>
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
                <RevenueWidget />
              </SectionBoundary>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
