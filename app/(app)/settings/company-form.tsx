"use client";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
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
        <Field>
          <FieldLabel htmlFor="company_name" className="text-xs font-medium">
            Razón social <span className="text-destructive">*</span>
          </FieldLabel>
          <Input
            id="company_name"
            name="company_name"
            required
            defaultValue={companyName}
            placeholder="Mi Empresa S.L."
            autoComplete="organization"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="company_nif" className="text-xs font-medium">
            NIF
          </FieldLabel>
          <Input
            id="company_nif"
            name="company_nif"
            defaultValue={companyNif}
            placeholder="B12345678"
            maxLength={20}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="invoice_series" className="text-xs font-medium">
            Serie factura
          </FieldLabel>
          <Input
            id="invoice_series"
            name="invoice_series"
            maxLength={10}
            defaultValue={invoiceSeries}
            placeholder="A"
            aria-describedby="invoice-series-hint"
          />
          <FieldDescription id="invoice-series-hint">
            Prefijo del número de factura (ej. A, 2026, FAC).
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="default_vat_rate" className="text-xs font-medium">
            IVA por defecto (%)
          </FieldLabel>
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
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="iban" className="text-xs font-medium">
            IBAN
          </FieldLabel>
          <Input
            id="iban"
            name="iban"
            defaultValue={iban}
            placeholder="ES00 0000 0000 0000 0000 0000"
            className="font-mono"
          />
          <FieldDescription>
            Se incluye en las facturas para pagos por transferencia.
          </FieldDescription>
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="company_address" className="text-xs font-medium">
          Dirección fiscal
        </FieldLabel>
        <Textarea
          id="company_address"
          name="company_address"
          rows={2}
          defaultValue={companyAddress}
          placeholder={"Calle, número\nCP Ciudad, País"}
        />
      </Field>
      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        <FormFeedback state={feedback.state} successLabel="Empresa guardada" />
        <SubmitButton pendingLabel="Guardando…" loading={feedback.pending}>
          Guardar empresa
        </SubmitButton>
      </div>
    </form>
  );
}
