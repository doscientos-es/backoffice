"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { relativeTime } from "@/lib/utils";
import { ArrowUpRight, Building2, Mail, Phone, User, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export type QuickClient = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  nif: string | null;
  contact_person: string | null;
  updated_at: string;
};

export function ClientQuickView({
  client,
  onClose,
}: { client: QuickClient | null; onClose: () => void }) {
  return (
    <Drawer open={!!client} onOpenChange={(v) => !v && onClose()} direction="right">
      <DrawerContent className="sm:max-w-sm">
        {client ? <Body client={client} /> : null}
      </DrawerContent>
    </Drawer>
  );
}

function Body({ client }: { client: QuickClient }) {
  return (
    <>
      <DrawerHeader className="flex flex-row items-start justify-between gap-2 border-b border-border">
        <div className="flex flex-col gap-1">
          <DrawerTitle>{client.name}</DrawerTitle>
          <DrawerDescription className="flex items-center gap-1.5">
            {client.nif && <Badge variant="neutral">{client.nif}</Badge>}
            <span className="text-[11px] tabular-nums">
              Actualizado {relativeTime(client.updated_at)}
            </span>
          </DrawerDescription>
        </div>
        <DrawerClose asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Cerrar">
            <X className="size-4" />
          </Button>
        </DrawerClose>
      </DrawerHeader>

      <div className="flex flex-col gap-6 overflow-y-auto p-4">
        <section className="flex flex-col gap-2.5 text-xs">
          <Heading>Información de contacto</Heading>
          {client.contact_person && (
            <Row icon={<User className="size-3.5" />}>{client.contact_person}</Row>
          )}
          {client.email && (
            <Row icon={<Mail className="size-3.5" />} href={`mailto:${client.email}`}>
              {client.email}
            </Row>
          )}
          {client.phone && (
            <Row icon={<Phone className="size-3.5" />} href={`tel:${client.phone}`}>
              {client.phone}
            </Row>
          )}
        </section>

        {/* Aquí se podrían añadir más secciones como "Proyectos activos" o "Facturas pendientes" */}
        {/* mediante fetching en un componente separado o pasando más data */}
      </div>

      <div className="mt-auto border-t border-border p-3">
        <Button asChild className="w-full" size="sm" variant="outline">
          <Link href={`/clients/${client.id}`}>
            Ver detalle completo
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    </>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function Row({
  icon,
  href,
  children,
}: { icon: ReactNode; href?: string; children: ReactNode }) {
  const inner = (
    <>
      <span className="text-muted-foreground">{icon}</span>
      <span className="truncate">{children}</span>
    </>
  );
  return href ? (
    <a href={href} className="flex items-center gap-2 hover:text-primary transition-colors">
      {inner}
    </a>
  ) : (
    <div className="flex items-center gap-2">{inner}</div>
  );
}
