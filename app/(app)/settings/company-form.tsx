"use client";

import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { updateCompanySettings } from "./actions";

interface Props {
  companyName: string;
  companyNif: string;
  invoiceSeries: string;
  defaultVatRate: number;
  iban: string;
  companyAddress: string;
}

export function CompanyForm({
  companyName,
  companyNif,
  invoiceSeries,
  defaultVatRate,
  iban,
  companyAddress,
}: Props) {
  const feedback = useFormFeedback();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    feedback.setPending();
    const result = await updateCompanySettings(fd);
    if (result.ok) feedback.setSuccess("Empresa guardada");
    else feedback.setError(result.error);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="company_name" className="text-xs font-medium">
            Razón social <span className="text-destructive">*</span>
          </Label>
          <Input
            id="company_name"
            name="company_name"
            required
            defaultValue={companyName}
            placeholder="Mi Empresa S.L."
            autoComplete="organization"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="company_nif" className="text-xs font-medium">NIF</Label>
          <Input
            id="company_nif"
            name="company_nif"
            defaultValue={companyNif}
            placeholder="B12345678"
            maxLength={20}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invoice_series" className="text-xs font-medium">
            Serie factura
          </Label>
          <Input
            id="invoice_series"
            name="invoice_series"
            maxLength={10}
            defaultValue={invoiceSeries}
            placeholder="A"
            aria-describedby="invoice-series-hint"
          />
          <p id="invoice-series-hint" className="text-[11px] text-muted-foreground">
            Prefijo del número de factura (ej. A, 2026, FAC).
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="default_vat_rate" className="text-xs font-medium">
            IVA por defecto (%)
          </Label>
          <Input
            id="default_vat_rate"
            name="default_vat_rate"
            type="number"
            inputMode="decimal"
            min="0"
            max="100"
            step="0.01"
            defaultValue={defaultVatRate}
            placeholder="21"
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="iban" className="text-xs font-medium">IBAN</Label>
          <Input
            id="iban"
            name="iban"
            defaultValue={iban}
            placeholder="ES00 0000 0000 0000 0000 0000"
            className="font-mono"
          />
          <p className="text-[11px] text-muted-foreground">
            Se incluye en las facturas para pagos por transferencia.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="company_address" className="text-xs font-medium">
          Dirección fiscal
        </Label>
        <Textarea
          id="company_address"
          name="company_address"
          rows={2}
          defaultValue={companyAddress}
          placeholder={"Calle, número\nCP Ciudad, País"}
        />
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        <FormFeedback state={feedback.state} successLabel="Empresa guardada" />
        <SubmitButton pendingLabel="Guardando…" loading={feedback.pending}>
          Guardar empresa
        </SubmitButton>
      </div>
    </form>
  );
}
