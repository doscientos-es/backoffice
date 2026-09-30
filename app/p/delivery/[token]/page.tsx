import { CircleCheck as CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Markdown } from "@/components/ui/markdown";
import { getCurrentUser } from "@/lib/auth";
import { DELIVERY_NOTE_CONSENT, type DeliveryNoteSnapshot } from "@/lib/delivery-acceptance";
import { ProposalPortalToken } from "@/lib/schemas/proposal";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils";

import { DeliverySignForm } from "./delivery-sign-form";

export const metadata: Metadata = { title: "Albarán de entrega · doscientos" };
export const dynamic = "force-dynamic";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
      {children}
    </section>
  );
}

export default async function PortalDeliveryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!ProposalPortalToken.safeParse(token).success) notFound();

  const admin = createAdminClient();
  const { data: delivery } = await admin
    .from("delivery_acceptances")
    .select(
      "id, status, document_snapshot, document_hash, sent_at, first_viewed_at, accepted_at, accepted_by_name, accepted_by_role",
    )
    .eq("portal_token", token)
    .maybeSingle();
  if (!delivery || delivery.status === "draft") notFound();

  const auth = await getCurrentUser();
  const isPending = delivery.status === "sent" || delivery.status === "viewed";
  if (isPending && !auth.ok && !delivery.first_viewed_at) {
    const now = new Date().toISOString();
    await admin
      .from("delivery_acceptances")
      .update({ status: "viewed", first_viewed_at: now })
      .eq("id", delivery.id)
      .eq("status", "sent");
    await admin.from("delivery_acceptance_events").insert({
      delivery_acceptance_id: delivery.id,
      event_type: "viewed",
      actor_type: "client",
      metadata: {},
    });
  }

  const doc = delivery.document_snapshot as DeliveryNoteSnapshot;
  const modules = doc.scope_modules ?? [];
  const isSigned = delivery.status === "accepted";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8 sm:px-6">
      <article className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <header className="border-b border-zinc-200 px-6 py-6 sm:px-8 dark:border-zinc-800">
          <p className="text-[11px] font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-500">
            Albarán de entrega
            {doc.proposal?.number ? ` · ${doc.proposal.number}` : ""}
          </p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-100">
            {doc.proposal?.title}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            {doc.client_name}
            {doc.project_name ? ` · ${doc.project_name}` : ""}
            {delivery.sent_at ? ` · Emitido el ${formatDate(delivery.sent_at as string)}` : ""}
          </p>
        </header>

        <div className="flex flex-col gap-4 px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-3 text-sm text-zinc-700 dark:text-zinc-300">
            {(doc.statement ?? "").split("\n\n").map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          {modules.length > 0 && (
            <Section title="Trabajos entregados">
              <ul className="flex flex-col gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                {modules.map((module) => (
                  <li key={module.title}>
                    <p className="font-medium text-zinc-800 dark:text-zinc-200">{module.title}</p>
                    {module.included.length > 0 && (
                      <ul className="mt-1 list-disc pl-5">
                        {module.included.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {doc.deliverables && (
            <Section title="Entregables">
              <Markdown source={doc.deliverables} className="text-sm text-zinc-600 dark:text-zinc-400" />
            </Section>
          )}
          {doc.acceptance_criteria && (
            <Section title="Criterios de aceptación">
              <Markdown
                source={doc.acceptance_criteria}
                className="text-sm text-zinc-600 dark:text-zinc-400"
              />
            </Section>
          )}
        </div>
      </article>

      {isSigned ? (
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertTitle>Albarán firmado</AlertTitle>
          <AlertDescription>
            Firmado por {delivery.accepted_by_name as string}
            {delivery.accepted_by_role ? ` (${delivery.accepted_by_role as string})` : ""} el{" "}
            {formatDate(delivery.accepted_at as string)}. Huella del documento:{" "}
            <code className="text-xs break-all">{delivery.document_hash as string}</code>
          </AlertDescription>
        </Alert>
      ) : isPending ? (
        auth.ok ? (
          <Alert>
            <AlertTitle>Vista previa del equipo</AlertTitle>
            <AlertDescription>El cliente firmará el albarán desde este enlace.</AlertDescription>
          </Alert>
        ) : (
          <DeliverySignForm token={token} consent={doc.consent ?? DELIVERY_NOTE_CONSENT} />
        )
      ) : (
        <Alert variant="destructive">
          <AlertTitle>Albarán no disponible</AlertTitle>
          <AlertDescription>Este albarán ha sido sustituido o anulado.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
