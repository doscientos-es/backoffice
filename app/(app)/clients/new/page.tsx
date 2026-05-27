import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "../actions";
import { ClientFormFields } from "../client-form-fields";

export const metadata: Metadata = { title: "Nuevo cliente · doscientos" };

export default async function NewClientPage() {
  await requireUser();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nuevo cliente"
        description="Registra un nuevo cliente."
        back={<BackLink href="/clients" label="Volver a clientes" />}
      />
      <Card>
        <CardContent className="pt-6">
          <form action={createClient} className="flex flex-col gap-5">
            <ClientFormFields idPrefix="new" autoFocusName />
            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button asChild variant="ghost" size="sm">
                <Link href="/clients">Cancelar</Link>
              </Button>
              <SubmitButton pendingLabel="Creando…">Crear cliente</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
