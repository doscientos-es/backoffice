"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Building2, FileText, MapPin, User } from "lucide-react";
import type * as React from "react";
import { useEffect, useState } from "react";
import type { AutofillData } from "./nif-input";

export type ApplySelection = {
  name?: string;
  province?: string;
  city?: string;
  address?: string;
  contactPerson?: string;
};

type Fields = { name: boolean; province: boolean; city: boolean; address: boolean };

function FieldRow({
  icon,
  label,
  value,
  checked,
  onCheckedChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  checked: boolean;
  onCheckedChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/50">
      <Checkbox checked={checked} onCheckedChange={onCheckedChange} />
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="min-w-0 text-sm">
        <span className="font-medium text-muted-foreground">{label}: </span>
        <span className="truncate">{value}</span>
      </span>
    </label>
  );
}

export function EnrichmentDialog({
  open,
  data,
  onApplyAction,
  onCloseAction,
}: {
  open: boolean;
  data: AutofillData;
  onApplyAction: (s: ApplySelection) => void;
  onCloseAction: () => void;
}) {
  const [fields, setFields] = useState<Fields>({
    name: !!data.name,
    province: !!data.province,
    city: !!data.city,
    address: !!data.address,
  });
  const [officer, setOfficer] = useState<string | null>(null);

  // Reset selections whenever a new company is loaded
  useEffect(() => {
    setFields({
      name: !!data.name,
      province: !!data.province,
      city: !!data.city,
      address: !!data.address,
    });
    setOfficer(null);
  }, [data]);

  const toggle = (k: keyof Fields) => setFields((f) => ({ ...f, [k]: !f[k] }));
  const anySelected = Object.values(fields).some(Boolean) || officer !== null;

  const handleApply = () => {
    const s: ApplySelection = {};
    if (fields.name && data.name) s.name = data.name;
    if (fields.province && data.province) s.province = data.province;
    if (fields.city && data.city) s.city = data.city;
    if (fields.address && data.address) s.address = data.address;
    if (officer) s.contactPerson = officer;
    onApplyAction(s);
    onCloseAction();
  };

  const statusVariant = data.companyStatus?.toUpperCase() === "ACTIVA" ? "success" : "warning";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onCloseAction();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Datos del Registro Mercantil</DialogTitle>
          <DialogDescription>Selecciona los campos a importar al cliente.</DialogDescription>
        </DialogHeader>

        {/* Company header */}
        <div className="flex items-start gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
          <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{data.name}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {data.companyType && (
                <Badge variant="neutral" className="text-[10px]">
                  {data.companyType}
                </Badge>
              )}
              {data.companyStatus && (
                <Badge variant={statusVariant} className="text-[10px]">
                  {data.companyStatus}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Field checkboxes */}
        <div className="flex flex-col gap-0.5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Campos disponibles
          </p>
          {data.name && (
            <FieldRow
              icon={<Building2 className="size-3.5" />}
              label="Nombre"
              value={data.name}
              checked={fields.name}
              onCheckedChange={() => toggle("name")}
            />
          )}
          {data.province && (
            <FieldRow
              icon={<MapPin className="size-3.5" />}
              label="Provincia"
              value={data.province}
              checked={fields.province}
              onCheckedChange={() => toggle("province")}
            />
          )}
          {data.city && (
            <FieldRow
              icon={<MapPin className="size-3.5" />}
              label="Ciudad"
              value={data.city}
              checked={fields.city}
              onCheckedChange={() => toggle("city")}
            />
          )}
          {data.address && (
            <FieldRow
              icon={<FileText className="size-3.5" />}
              label="Dirección"
              value={data.address}
              checked={fields.address}
              onCheckedChange={() => toggle("address")}
            />
          )}
        </div>

        {/* Officer radio selection */}
        {!!data.officers?.length && (
          <div className="flex flex-col gap-0.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Persona de contacto
            </p>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/50">
              <input
                type="radio"
                name="enrich-officer"
                value=""
                checked={officer === null}
                onChange={() => setOfficer(null)}
                className="size-3.5 accent-primary"
              />
              <span className="text-sm italic text-muted-foreground">No asignar</span>
            </label>
            {data.officers.map((o) => (
              <label
                key={o.name}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/50"
              >
                <input
                  type="radio"
                  name="enrich-officer"
                  value={o.name}
                  checked={officer === o.name}
                  onChange={() => setOfficer(o.name)}
                  className="size-3.5 accent-primary"
                />
                <User className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 text-sm">
                  <span className="font-medium">{o.name}</span>
                  <span className="ml-1 text-[11px] italic text-muted-foreground">({o.role})</span>
                </span>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCloseAction}>
            Cancelar
          </Button>
          <Button onClick={handleApply} disabled={!anySelected}>
            Aplicar selección
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
