import { AlertTriangle, Clock3, FileText, Users } from "lucide-react";
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
      href: "/proposals",
      label: "Propuestas esperando",
      value: data.counts.pendingProposals,
      detail: "más de 72 h",
      icon: FileText,
      tone: "text-violet-500",
    },
  ];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Users className="size-4 text-primary" /> Control comercial
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
              className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/60"
            >
              <Icon className={`size-4 shrink-0 ${item.tone}`} />
              <span className="min-w-0">
                <span className="block text-xl font-semibold tabular-nums">{item.value}</span>
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
