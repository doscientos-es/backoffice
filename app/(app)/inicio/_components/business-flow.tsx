import {
  ArrowRightIcon as ArrowRight,
  Suitcase as BriefcaseBusiness,
  CurrencyCircleDollar as CircleDollarSign,
  FileText as FileSignature,
  Receipt as ReceiptText,
  Sparkle as Sparkles,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { CrossModulePulse } from "@/lib/dashboard/cross-module";
import { cn } from "@/lib/utils";

const stages = [
  {
    key: "leads",
    label: "Oportunidades",
    href: "/leads",
    icon: CircleDollarSign,
    tone: "text-blue-500",
  },
  {
    key: "proposals",
    label: "Propuestas",
    href: "/proposals",
    icon: FileSignature,
    tone: "text-violet-500",
  },
  {
    key: "projects",
    label: "En entrega",
    href: "/projects",
    icon: BriefcaseBusiness,
    tone: "text-amber-500",
  },
  {
    key: "overdueInvoices",
    label: "Cobros",
    href: "/invoices?status=overdue",
    icon: ReceiptText,
    tone: "text-rose-500",
  },
] as const;

export function BusinessFlow({ pulse }: { pulse: CrossModulePulse }) {
  const overdue = pulse.overdueInvoices > 0;
  return (
    <Card className="relative overflow-hidden border-primary/15 bg-gradient-to-br from-primary/[0.08] via-card to-card shadow-sm">
      <div className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <Sparkles className="size-3.5" />
              Flujo del negocio
            </div>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">
              Del primer contacto al cobro
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Una vista viva de las transiciones que mantienen el negocio avanzando.
            </p>
          </div>
          <Badge variant={overdue ? "danger" : "success"} className="gap-1.5">
            <span
              className={cn("size-1.5 rounded-full", overdue ? "bg-rose-500" : "bg-emerald-500")}
            />
            {overdue
              ? `${pulse.overdueInvoices} cobro${pulse.overdueInvoices === 1 ? "" : "s"} requiere acción`
              : "Todo bajo control"}
          </Badge>
        </div>

        <div className="mt-6 grid gap-2 md:grid-cols-4">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            const value = pulse[stage.key];
            return (
              <div key={stage.key} className="group relative">
                <Link
                  href={stage.href}
                  className="flex min-h-[108px] flex-col justify-between rounded-xl border border-border/80 bg-background/70 p-3.5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-background hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Icon className={cn("size-4", stage.tone)} />
                    <ArrowRight className="size-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                  <div>
                    <div className="text-2xl font-semibold tabular-nums tracking-tight">
                      {value}
                    </div>
                    <div className="text-xs text-muted-foreground">{stage.label}</div>
                  </div>
                </Link>
                {index < stages.length - 1 ? (
                  <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden size-4 -translate-y-1/2 text-muted-foreground/40 md:block" />
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
          <p className="text-xs text-muted-foreground">
            Cada etapa enlaza con el contexto operativo y la siguiente acción.
          </p>
          <Link
            href="/leads"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            Abrir centro comercial <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </Card>
  );
}
