import { getCurrentUser } from "@/lib/auth";
import type { BillingCycle } from "@/lib/finance";
import { scopedLogger } from "@/lib/logger";
import { type KeyPoint, parseKeyPoints } from "@/lib/proposals/key-points";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DeckViewer } from "./deck-viewer-client";

const log = scopedLogger("deck.page");

export const dynamic = "force-dynamic";

export type DeckProposalItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  subtotal: number;
  billing_cycle: BillingCycle | null;
};

export type DeckTeamMember = {
  id: string;
  name: string;
  job_title: string | null;
  avatar_url: string | null;
};

export type DeckProposal = {
  id: string;
  number: string;
  title: string;
  context_markdown: string | null;
  problems: KeyPoint[];
  solutions: KeyPoint[];
  terms: string | null;
  notes: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  valid_until: string | null;
  created_at: string | null;
  client_name: string | null;
  client_email: string | null;
  client_logo_url: string | null;
};

export async function generateMetadata({
  params,
}: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("proposals")
    .select("number, title, status, clients(name)")
    .eq("portal_token", token)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data || data.status === "draft") {
    return { title: "Propuesta · doscientos", robots: { index: false, follow: false } };
  }
  const clientName =
    (data as unknown as { clients: { name: string } | null }).clients?.name ?? null;
  const suffix = clientName ? ` para ${clientName}` : "";
  return {
    title: `Propuesta ${data.number as string}${suffix} · doscientos`,
    description: (data.title as string) ?? undefined,
    robots: { index: false, follow: false },
  };
}

export default async function DeckPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  // Resolve auth first so team members can preview drafts.
  const auth = await getCurrentUser();
  const isTeam = auth.ok;

  const { data: proposal } = await admin
    .from("proposals")
    .select("*, clients(name, email, logo_url)")
    .eq("portal_token", token)
    .is("deleted_at", null)
    .maybeSingle();

  // Drafts are only accessible to authenticated team members.
  if (!proposal || (proposal.status === "draft" && !isTeam)) notFound();

  const isDraft = proposal.status === "draft";

  const [{ data: items }, { data: team }] = await Promise.all([
    admin
      .from("proposal_items")
      .select("id, position, description, quantity, unit_price, vat_rate, subtotal, billing_cycle")
      .eq("proposal_id", proposal.id as string)
      .order("position"),
    admin
      .from("team_members")
      .select("id, name, job_title, avatar_url")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(6),
  ]);

  // Bump status from 'sent' to 'viewed' on the first external (client) open
  // of the deck. Team previews and drafts never transition the status.
  if (!isTeam && !isDraft && proposal.status === "sent") {
    await admin
      .from("proposals")
      .update({ status: "viewed", viewed_at: new Date().toISOString() })
      .eq("id", proposal.id as string)
      .eq("status", "sent");
  }

  // Best-effort page-level view tracking. Skipped for draft previews.
  if (!isDraft) {
    try {
      const h = await headers();
      const forwarded = h.get("x-forwarded-for");
      const ip = forwarded ? forwarded.split(",")[0]?.trim() : (h.get("x-real-ip") ?? null);
      const userAgent = h.get("user-agent");
      await admin.from("proposal_view_events").insert({
        proposal_id: proposal.id as string,
        viewer_type: isTeam ? "team" : "client",
        team_member_id: isTeam ? auth.user.id : null,
        surface: "deck",
        ip,
        user_agent: userAgent,
      });
    } catch (err) {
      log.warn({ err, proposalId: proposal.id }, "deck_view_insert_failed");
    }
  }

  const client = (
    proposal as unknown as {
      clients: { name: string; email: string | null; logo_url: string | null } | null;
    }
  ).clients;

  const deckProposal: DeckProposal = {
    id: proposal.id as string,
    number: proposal.number as string,
    title: proposal.title as string,
    context_markdown: (proposal.context_markdown as string | null) ?? null,
    problems: parseKeyPoints(proposal.problems),
    solutions: parseKeyPoints(proposal.solutions),
    terms: (proposal.terms as string | null) ?? null,
    notes: (proposal.notes as string | null) ?? null,
    subtotal: proposal.subtotal as number,
    tax_amount: proposal.tax_amount as number,
    total: proposal.total as number,
    valid_until: (proposal.valid_until as string | null) ?? null,
    created_at: (proposal.created_at as string | null) ?? null,
    client_name: client?.name ?? null,
    client_email: client?.email ?? null,
    client_logo_url: client?.logo_url ?? null,
  };

  const deckItems = (items ?? []) as unknown as DeckProposalItem[];
  const deckTeam = (team ?? []) as unknown as DeckTeamMember[];

  return (
    <DeckViewer
      proposal={deckProposal}
      items={deckItems}
      team={deckTeam}
      token={token}
      isDraft={isDraft}
    />
  );
}
