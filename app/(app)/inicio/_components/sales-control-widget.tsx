import { TriangleAlert as AlertTriangle, Clock as Clock3, FileText, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFollowUps } from "@/lib/integrations/follow-ups";

/** Team radar for owners/admins: signals that need coordination, not just personal action. */
export async function SalesControlWidget() {
  const data = await getFollowUps({ slaHours: 4, leadHours: 24, proposalHours: 72 });
  const items = [
    {
      href: "/leads?attention=urgent",
      label: "Sin primer contacto",
      value: data.counts.uncontactedLeads,
      detail: "más de 4 h",
      icon: Clock3,
      tone: "text-red-500",
    },
    {
      href: "/leads?attention=stale",
      label: "Leads estancados",
      value: data.counts.staleLeads,
      detail: "más de 24 h",
      icon: AlertTriangle,
      tone: "text-amber-500",
    },
    {
      href: "/proposals?followup=waiting_72",
      label: "Propuestas esperando",
      value: data.counts.pendingProposals,
      detail: "más de 72 h",
      icon: FileText,
      tone: "text-violet-500",
    },
  ];

  return (
    <Card className="border-primary/15 bg-gradient-to-br from-primary/[0.08] via-card to-card shadow-sm">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users className="size-4" />
          </span>
          <span>
            Control comercial
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              Señales que requieren coordinación
            </span>
          </span>
        </CardTitle>
        <Badge variant="neutral">Equipo</Badge>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className="group flex items-center gap-3 rounded-xl border border-border/70 bg-background/65 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:bg-background hover:shadow-sm"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                <Icon className={`size-4 ${item.tone}`} />
              </span>
              <span className="min-w-0">
                <span className="block text-2xl font-semibold tabular-nums">{item.value}</span>
                <span className="block truncate text-xs font-medium">{item.label}</span>
                <span className="block text-[11px] text-muted-foreground">{item.detail}</span>
              </span>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
