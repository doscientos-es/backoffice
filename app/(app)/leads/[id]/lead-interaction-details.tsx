"use client";

import { Eye, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MemberLabel } from "@/components/ui/member-avatar";
import { interactionBodyText } from "@/lib/leads/interaction-utils";
import type { LeadDetailInteraction } from "@/lib/leads/types";

function payloadText(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>)[key];
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    const items = value.filter((item): item is string => typeof item === "string" && Boolean(item));
    return items.length ? items.join(", ") : null;
  }
  return null;
}

function emailMetadata(payload: unknown): Array<[string, string]> {
  const metadata: Array<[string, string]> = [];
  const fields = [
    ["De", "from"],
    ["Para", "to"],
    ["CC", "cc"],
    ["Contacto", "counterparty"],
  ] as const;

  for (const [label, key] of fields) {
    const value = payloadText(payload, key);
    if (value) metadata.push([label, value]);
  }
  return metadata;
}

export function LeadInteractionDetails({
  interaction,
  label,
}: {
  interaction: LeadDetailInteraction;
  label: string;
}) {
  const body = interactionBodyText(interaction.body);
  const isEmail = interaction.type.startsWith("email_");
  const metadata = isEmail ? emailMetadata(interaction.payload) : [];

  if (!body) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-6 shrink-0 gap-1 px-2 text-xs text-muted-foreground"
        >
          <Eye className="size-3" />
          Ver detalles
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle className="flex items-center gap-2">
            {isEmail ? <Mail className="size-4 text-primary" /> : null}
            {interaction.subject ?? label}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <span>{new Date(interaction.created_at).toLocaleString("es-ES")}</span>
            {interaction.performer ? (
              <MemberLabel member={interaction.performer} size="xs" />
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
          {metadata.length ? (
            <dl className="grid gap-x-3 gap-y-1 rounded-md border bg-muted/20 p-3 text-xs sm:grid-cols-[auto_1fr]">
              {metadata.map(([name, value]) => (
                <div key={name} className="contents">
                  <dt className="font-medium text-muted-foreground">{name}</dt>
                  <dd className="min-w-0 break-words">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <p className="whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-4 text-sm leading-relaxed">
            {body}
          </p>
        </div>
        <div className="flex shrink-0 justify-end">
          <CopyButton text={body} label="Copiar contenido" className="size-8" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
