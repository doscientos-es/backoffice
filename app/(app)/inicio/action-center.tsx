import { AlertTriangle, CheckSquare, FileSignature, Receipt, UserRound } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionCenterData, ActionCenterItem } from "@/lib/dashboard/types";

const ICONS = {
  task: CheckSquare,
  lead: UserRound,
  proposal: FileSignature,
  invoice: Receipt,
} as const;

const LABELS = {
  task: "Tarea",
  lead: "SLA comercial",
  proposal: "Seguimiento",
  invoice: "Cobro",
} as const;

export function ActionCenter({ items, total }: ActionCenterData) {
  if (items.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-primary/[0.03] shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-primary" /> Para resolver
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Señales explícitas del sistema con un siguiente paso claro.
          </p>
        </div>
        <Badge variant="outline">{total} pendientes</Badge>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <ActionItem key={`${item.kind}-${item.id}`} item={item} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ActionItem({ item }: { item: ActionCenterItem }) {
  const Icon = ICONS[item.kind];
  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{item.title}</span>
          <Badge variant={item.severity === "urgent" ? "danger" : "warning"}>
            {LABELS[item.kind]}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
      </div>
      <Link href={item.href} className="shrink-0 text-xs font-medium text-primary hover:underline">
        {item.actionLabel}
      </Link>
    </li>
  );
}
