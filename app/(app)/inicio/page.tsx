import {
  AccountsReceivableSkeleton,
  AccountsReceivableWidget,
} from "@/components/finance/accounts-receivable-card";
import {
  MonthExpensesSkeleton,
  MonthExpensesWidget,
} from "@/components/finance/month-expenses-card";
import { SectionBoundary } from "@/components/ui/error-boundary";
import { canViewFinance, requireUser } from "@/lib/auth";
import { getGreeting, parseDashboardRange } from "@/lib/utils/date";
import type { Metadata } from "next";
import { AvisosWidget } from "./_components/avisos-widget";
import { KpiGrid } from "./_components/kpi-grid";
import { MoneyOpportunitiesWidget } from "./_components/money-opportunities-widget";
import { MyDayWidget } from "./_components/my-day-widget";
import { RangeSelector } from "./_components/range-selector";
import { RevenueWidget } from "./_components/revenue-widget";
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
  searchParams: Promise<{ range?: string | string[] }>;
};

export default async function InicioPage({ searchParams }: PageProps) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const range = parseDashboardRange(params.range);
  const greeting = getGreeting();
  const firstName = user.name.split(" ")[0];
  const showFinance = canViewFinance(user.role);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting}, {firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aquí tienes lo que requiere tu atención.
        </p>
      </div>

      {/* Para hoy: tu cola de trabajo y los avisos que requieren acción */}
      <div className="flex flex-col gap-4">
        <SectionBoundary pending={<MyDayWidgetSkeleton />} label="No se pudo cargar tu día">
          <MyDayWidget />
        </SectionBoundary>
        <SectionBoundary
          pending={<AvisosWidgetSkeleton />}
          label="No se pudieron cargar los avisos"
        >
          <AvisosWidget showFinance={showFinance} />
        </SectionBoundary>
      </div>

      <SectionBoundary
        pending={<MoneyOpportunitiesWidgetSkeleton />}
        label="No se pudieron cargar las oportunidades"
      >
        <MoneyOpportunitiesWidget />
      </SectionBoundary>

      {/* La empresa de un vistazo: KPIs comerciales + financieros (solo owner/admin) */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">La empresa de un vistazo</h2>
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
            <div className="grid gap-3 sm:grid-cols-2">
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
      </section>
    </div>
  );
}
