import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { createMilestone } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewMilestonePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  const supabase = await createServerClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (!project) notFound();

  async function handleCreate(formData: FormData) {
    "use server";
    const res = await createMilestone({
      projectId: id,
      name: formData.get("name"),
      description: formData.get("description"),
      amount: formData.get("amount") || undefined,
      start_date: formData.get("start_date") || undefined,
      due_date: formData.get("due_date") || undefined,
      is_payment_milestone: formData.get("is_payment_milestone") === "on",
      color: formData.get("color") || "#6366f1",
    });
    if (res.ok) redirect(`/projects/${id}/milestones`);
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <PageHeader
        title="Nuevo hito"
        description={project.name as string}
        back={<BackLink href={`/projects/${id}/milestones`} label="Volver a hitos" />}
      />
      <Card>
        <CardContent className="pt-6">
          <form action={handleCreate} className="flex flex-col gap-4">
            <FormRow label="Nombre" htmlFor="name" required>
              <Input id="name" name="name" required maxLength={200} placeholder="MVP entregado" />
            </FormRow>
            <FormRow label="Descripción" htmlFor="description">
              <Textarea id="description" name="description" rows={3} maxLength={4000} />
            </FormRow>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormRow label="Inicio" htmlFor="start_date">
                <Input id="start_date" name="start_date" type="date" />
              </FormRow>
              <FormRow label="Vencimiento" htmlFor="due_date">
                <Input id="due_date" name="due_date" type="date" />
              </FormRow>
            </div>
            <FormRow label="Importe (€)" htmlFor="amount">
              <Input id="amount" name="amount" type="number" step="0.01" min="0" placeholder="0.00" />
            </FormRow>
            <FormRow label="Color" htmlFor="color">
              <div className="flex items-center gap-2">
                <input id="color" name="color" type="color" defaultValue="#6366f1" className="h-8 w-14 cursor-pointer rounded border border-border" />
                <span className="text-xs text-muted-foreground">Color del hito en el calendario</span>
              </div>
            </FormRow>
            <FormRow label="Tipo" htmlFor="is_payment_milestone">
              <Select id="is_payment_milestone" name="is_payment_milestone">
                <option value="">Hito de progreso</option>
                <option value="on">Hito de pago</option>
              </Select>
            </FormRow>
            <div className="flex justify-end border-t border-border pt-3">
              <Button type="submit">Crear hito</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
