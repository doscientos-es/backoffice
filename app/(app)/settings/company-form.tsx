"use client";

import { Button } from "@/components/ui/button";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
          <Label htmlFor="company_name" className="text-xs font-medium">Razón social</Label>
          <Input id="company_name" name="company_name" required defaultValue={companyName} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="company_nif" className="text-xs font-medium">NIF</Label>
          <Input id="company_nif" name="company_nif" defaultValue={companyNif} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invoice_series" className="text-xs font-medium">Serie factura</Label>
          <Input
            id="invoice_series"
            name="invoice_series"
            maxLength={10}
            defaultValue={invoiceSeries}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="default_vat_rate" className="text-xs font-medium">IVA por defecto (%)</Label>
          <Input
            id="default_vat_rate"
            name="default_vat_rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue={defaultVatRate}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="iban" className="text-xs font-medium">IBAN</Label>
          <Input id="iban" name="iban" defaultValue={iban} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="company_address" className="text-xs font-medium">Dirección fiscal</Label>
        <Textarea
          id="company_address"
          name="company_address"
          rows={2}
          defaultValue={companyAddress}
        />
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        <FormFeedback state={feedback.state} successLabel="Empresa guardada" />
        <Button type="submit" size="sm" disabled={feedback.pending}>
          {feedback.pending ? "Guardando…" : "Guardar empresa"}
        </Button>
      </div>
    </form>
  );
}
