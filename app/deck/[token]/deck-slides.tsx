import { LogoMark } from "@/components/branding";
import { Markdown } from "@/components/ui/markdown";
import {
  BILLING_CYCLE_LABELS,
  type BillingCycle,
  computeProposalTotals,
  type ProposalTotals,
} from "@/lib/finance";
import type { KeyPoint } from "@/lib/proposals/key-points";
import { formatDate, formatEUR } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import type { DeckProposal, DeckProposalItem, DeckTeamMember } from "./page";

function buildTotals(items: DeckProposalItem[]): ProposalTotals {
  return computeProposalTotals(
    items.map((it) => ({
      quantity: it.quantity,
      unit_price: it.unit_price,
      vat_rate: it.vat_rate,
      billing_cycle: it.billing_cycle ?? "none",
    })),
  );
}

function hasRecurring(totals: ProposalTotals): boolean {
  return totals.monthly.total > 0 || totals.quarterly.total > 0 || totals.yearly.total > 0;
}

export type DeckSlide = {
  key: string;
  label: string;
  accent: "green" | "white" | "zinc";
  element: ReactNode;
};

function SlideWrapper({ children, watermark }: { children: ReactNode; watermark?: string }) {
  if (!watermark) return <>{children}</>;
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "contents" }}>
      {children}
      <div className="deck-watermark" aria-hidden>{watermark}</div>
    </div>
  );
}

function Stagger({ i, children, className }: { i: number; children: ReactNode; className?: string }) {
  return (
    <div className={`deck-stagger ${className ?? ""}`} style={{ ["--i" as string]: i }}>
      {children}
    </div>
  );
}

function CoverSlide({ proposal }: { proposal: DeckProposal }) {
  return (
    <div className="deck-slide bg-[#2A4227] text-white p-6 sm:p-10 md:p-16 lg:p-24 text-center">
      <Stagger i={0}>
        <LogoMark size={56} className="text-white/80 mb-8 sm:mb-12 sm:size-[72px]" />
      </Stagger>
      <Stagger i={1}>
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.25em] sm:tracking-[0.3em] text-white/50 mb-4 sm:mb-6">
          Propuesta {proposal.number}
        </p>
      </Stagger>
      <Stagger i={2}>
        <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl text-balance font-bold tracking-tight mb-6 sm:mb-8 max-w-4xl leading-[1.1]">
          {proposal.title}
        </h1>
      </Stagger>
      {proposal.client_name && (
        <Stagger i={3}>
          <p className="text-base sm:text-xl md:text-2xl text-white/70 font-light px-2">
            Preparado para <span className="text-white font-medium">{proposal.client_name}</span>
          </p>
        </Stagger>
      )}
      {proposal.valid_until && (
        <Stagger i={4}>
          <p className="mt-4 sm:mt-6 text-xs sm:text-sm text-white/40 uppercase tracking-widest">
            Válida hasta {formatDate(proposal.valid_until)}
          </p>
        </Stagger>
      )}
    </div>
  );
}

function SectionSlide({
  label,
  title,
  children,
  accent = "white",
}: {
  label: string;
  title: string;
  children: ReactNode;
  accent?: "white" | "zinc";
}) {
  const bg = accent === "zinc" ? "bg-zinc-50" : "bg-white";
  return (
    <div className={`deck-slide justify-center text-zinc-900 p-6 sm:p-10 md:p-16 lg:p-24 ${bg}`}>
      <Stagger i={0}>
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.25em] sm:tracking-[0.3em] text-[#2A4227] mb-3 sm:mb-4">
          {label}
        </p>
      </Stagger>
      <Stagger i={1}>
        <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-8 sm:mb-12 max-w-3xl leading-tight text-balance">
          {title}
        </h2>
      </Stagger>
      <Stagger i={2} className="w-full flex flex-col items-center">{children}</Stagger>
    </div>
  );
}

function ContextSlide({ proposal }: { proposal: DeckProposal }) {
  return (
    <SectionSlide label="Contexto" title="Dónde estamos hoy">
      <div className="max-w-3xl text-left w-full">
        <Markdown
          source={proposal.context_markdown ?? ""}
          className="deck-markdown deck-markdown-intro text-base sm:text-lg md:text-xl text-zinc-700"
        />
      </div>
    </SectionSlide>
  );
}

/**
 * Shared list slide used for problems and solutions. Both blocks share the
 * same layout but differ in badge palette so consecutive slides feel
 * distinct: muted neutral for problems (something we observed), brand
 * green for solutions (something we do about it).
 */
function KeyPointsListSlide({
  label,
  title,
  items,
  accent,
  badgeVariant,
}: {
  label: string;
  title: string;
  items: KeyPoint[];
  accent?: "white" | "zinc";
  badgeVariant: "muted" | "brand";
}) {
  const badgeClass =
    badgeVariant === "brand"
      ? "bg-[#2A4227] text-white"
      : "bg-zinc-200 text-zinc-700";
  return (
    <SectionSlide label={label} title={title} accent={accent}>
      <ul className="flex flex-col gap-4 sm:gap-6 max-w-3xl w-full text-left">
        {items.map((kp, i) => (
          <li
            key={kp.id}
            className="deck-stagger flex gap-4 sm:gap-5 items-start"
            style={{ ["--i" as string]: 3 + i }}
          >
            <span
              className={`shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold tabular-nums ${badgeClass}`}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="pt-1 sm:pt-1.5 min-w-0">
              <p className="font-semibold text-zinc-900 text-base sm:text-lg md:text-xl text-balance">
                {kp.title}
              </p>
              {kp.description ? (
                <p className="text-sm sm:text-base text-zinc-500 mt-1 sm:mt-1.5 whitespace-pre-wrap leading-relaxed">
                  {kp.description}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </SectionSlide>
  );
}

function CadenceBadge({ cycle }: { cycle: BillingCycle }) {
  if (cycle === "none") return null;
  return (
    <span className="inline-flex items-center rounded-full bg-[#2A4227]/10 px-2 py-0.5 text-[10px] sm:text-xs font-semibold text-[#2A4227] uppercase tracking-wider">
      {BILLING_CYCLE_LABELS[cycle]}
    </span>
  );
}

function ServicesSlide({ items }: { items: DeckProposalItem[] }) {
  return (
    <SectionSlide label="Servicios" title="Qué ofrecemos" accent="zinc">
      <ul className="flex flex-col gap-4 sm:gap-6 max-w-3xl w-full text-left">
        {items.map((item, i) => {
          const cycle: BillingCycle = item.billing_cycle ?? "none";
          return (
            <li key={item.id} className="deck-stagger flex gap-4 sm:gap-5 items-start" style={{ ["--i" as string]: 3 + i }}>
              <span className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#2A4227] text-white flex items-center justify-center text-xs sm:text-sm font-bold tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="pt-1 sm:pt-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-zinc-900 text-base sm:text-lg md:text-xl text-balance">{item.description}</p>
                  <CadenceBadge cycle={cycle} />
                </div>
                {item.quantity !== 1 && (
                  <p className="text-xs sm:text-sm text-zinc-500 mt-0.5 sm:mt-1">{item.quantity} unidades</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </SectionSlide>
  );
}

function PricingTotals({ totals }: { totals: ProposalTotals }) {
  const recurring = hasRecurring(totals);
  return (
    <div className="flex flex-col gap-3 items-end w-full">
      <div className="flex flex-col gap-2 items-end">
        {recurring ? (
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
            Inversión inicial
          </p>
        ) : null}
        <div className="flex gap-6 sm:gap-12 text-xs sm:text-sm text-zinc-500">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatEUR(totals.oneTime.subtotal)}</span>
        </div>
        <div className="flex gap-6 sm:gap-12 text-xs sm:text-sm text-zinc-500">
          <span>IVA</span>
          <span className="tabular-nums">{formatEUR(totals.oneTime.taxAmount)}</span>
        </div>
        <div className="flex gap-6 sm:gap-12 text-xl sm:text-2xl md:text-3xl font-bold text-zinc-900 border-t-2 border-zinc-300 pt-3 mt-2">
          <span>Total</span>
          <span className="tabular-nums">{formatEUR(totals.oneTime.total)}</span>
        </div>
      </div>

      {recurring ? (
        <div className="flex flex-col gap-2 items-end border-t border-zinc-200 pt-4 w-full">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.25em] text-[#2A4227]">
            Mantenimiento recurrente
          </p>
          {totals.monthly.total > 0 ? (
            <div className="flex gap-6 sm:gap-12 text-sm sm:text-base text-zinc-700">
              <span>Mensual</span>
              <span className="tabular-nums font-semibold">{formatEUR(totals.monthly.total)}</span>
            </div>
          ) : null}
          {totals.quarterly.total > 0 ? (
            <div className="flex gap-6 sm:gap-12 text-sm sm:text-base text-zinc-700">
              <span>Trimestral</span>
              <span className="tabular-nums font-semibold">{formatEUR(totals.quarterly.total)}</span>
            </div>
          ) : null}
          {totals.yearly.total > 0 ? (
            <div className="flex gap-6 sm:gap-12 text-sm sm:text-base text-zinc-700">
              <span>Anual</span>
              <span className="tabular-nums font-semibold">{formatEUR(totals.yearly.total)}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PricingSlide({ items }: { proposal: DeckProposal; items: DeckProposalItem[] }) {
  const totals = buildTotals(items);
  return (
    <SectionSlide label="Inversión" title="Detalle económico">
      <div className="max-w-3xl w-full">
        <table className="w-full text-xs sm:text-sm md:text-base mb-6 sm:mb-8 text-left">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="text-left py-2 sm:py-3 text-zinc-500 font-medium uppercase tracking-wider text-[10px] sm:text-xs">Descripción</th>
              <th className="hidden sm:table-cell text-right py-3 text-zinc-500 font-medium uppercase tracking-wider text-xs">Cant.</th>
              <th className="hidden sm:table-cell text-right py-3 text-zinc-500 font-medium uppercase tracking-wider text-xs">Precio</th>
              <th className="text-right py-2 sm:py-3 text-zinc-500 font-medium uppercase tracking-wider text-[10px] sm:text-xs">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const cycle: BillingCycle = item.billing_cycle ?? "none";
              return (
                <tr key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                  <td className="py-3 sm:py-4 pr-3 text-zinc-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{item.description}</span>
                      <CadenceBadge cycle={cycle} />
                    </div>
                    <span className="block sm:hidden text-[11px] text-zinc-500 mt-0.5 tabular-nums">
                      {item.quantity} × {formatEUR(item.unit_price)}
                    </span>
                  </td>
                  <td className="hidden sm:table-cell py-4 text-right tabular-nums text-zinc-500">{item.quantity}</td>
                  <td className="hidden sm:table-cell py-4 text-right tabular-nums text-zinc-500">{formatEUR(item.unit_price)}</td>
                  <td className="py-3 sm:py-4 text-right tabular-nums font-medium whitespace-nowrap">{formatEUR(item.subtotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <PricingTotals totals={totals} />
      </div>
    </SectionSlide>
  );
}

function TeamSlide({ team }: { team: DeckTeamMember[] }) {
  return (
    <SectionSlide label="El equipo" title="Quién trabajará en tu proyecto">
      <div className="flex flex-wrap justify-center gap-6 sm:gap-10 max-w-3xl">
        {team.map((member, i) => (
          <div key={member.id} className="deck-stagger flex flex-col items-center gap-2 sm:gap-3" style={{ ["--i" as string]: 3 + i }}>
            <div className="size-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-zinc-200 ring-2 ring-[#2A4227]/10">
              {member.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={member.avatar_url} alt={member.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#2A4227] text-white text-xl sm:text-2xl font-bold">
                  {member.name.charAt(0)}
                </div>
              )}
            </div>
            <div className="text-center">
              <p className="font-semibold text-zinc-900 text-xs sm:text-sm">{member.name}</p>
              {member.job_title && <p className="text-[11px] sm:text-xs text-zinc-500 mt-0.5">{member.job_title}</p>}
            </div>
          </div>
        ))}
      </div>
    </SectionSlide>
  );
}

function PricingBarChart({ items }: { proposal: DeckProposal; items: DeckProposalItem[] }) {
  const maxVal = Math.max(...items.map((i) => i.subtotal), 1);
  const totals = buildTotals(items);
  return (
    <SectionSlide label="Inversión" title="Detalle económico">
      <div className="max-w-3xl w-full">
        <div className="flex flex-col gap-4 sm:gap-5 mb-6 sm:mb-8">
          {items.map((item, i) => {
            const cycle: BillingCycle = item.billing_cycle ?? "none";
            return (
              <div key={item.id} className="deck-stagger" style={{ ["--i" as string]: 3 + i }}>
                <div className="flex justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs sm:text-sm text-zinc-700 truncate text-left">{item.description}</span>
                    <CadenceBadge cycle={cycle} />
                  </div>
                  <span className="text-xs sm:text-sm font-semibold tabular-nums text-zinc-900 whitespace-nowrap">{formatEUR(item.subtotal)}</span>
                </div>
                <div className="h-1.5 sm:h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#2A4227] rounded-full" style={{ width: `${(item.subtotal / maxVal) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t border-zinc-200 pt-4">
          <PricingTotals totals={totals} />
        </div>
      </div>
    </SectionSlide>
  );
}

function TermsSlide({ proposal }: { proposal: DeckProposal }) {
  return (
    <SectionSlide label="Condiciones" title="Términos del acuerdo" accent="zinc">
      <div className="max-w-3xl text-left w-full">
        <Markdown
          source={proposal.terms ?? ""}
          className="deck-markdown deck-markdown-terms text-sm sm:text-base text-zinc-600"
        />
      </div>
    </SectionSlide>
  );
}

function ClosingSlide({ proposal, token }: { proposal: DeckProposal; token: string }) {
  return (
    <div className="deck-slide bg-[#2A4227] text-white p-6 sm:p-10 md:p-16 lg:p-24 text-center">
      <Stagger i={0}>
        <LogoMark size={48} className="text-white/60 mb-8 sm:mb-12 sm:size-[56px]" />
      </Stagger>
      <Stagger i={1}>
        <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6 tracking-tight">¿Hablamos?</h2>
      </Stagger>
      <Stagger i={2}>
        <p className="text-white/60 text-base sm:text-lg md:text-xl max-w-xl font-light leading-relaxed mb-8 sm:mb-12 px-2">
          Estamos listos para empezar. Cuando confirmes, arrancamos.
        </p>
      </Stagger>
      <Stagger i={3}>
        <a
          href={`/p/proposal/${token}`}
          className="inline-flex items-center gap-2 sm:gap-3 rounded-full bg-white text-[#2A4227] px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-semibold hover:bg-white/90 hover:gap-4 transition-all shadow-lg"
        >
          Ver propuesta y aceptar
          <ArrowRight className="size-4 sm:size-5" />
        </a>
      </Stagger>
      {proposal.client_name && (
        <Stagger i={4}>
          <p className="mt-10 sm:mt-16 text-[10px] sm:text-xs text-white/40 uppercase tracking-[0.25em] sm:tracking-[0.3em]">{proposal.client_name}</p>
        </Stagger>
      )}
    </div>
  );
}

export function buildSlides(
  proposal: DeckProposal,
  items: DeckProposalItem[],
  token: string,
  team: DeckTeamMember[] = [],
  watermark?: string,
): DeckSlide[] {
  const wm = (el: ReactNode): ReactNode =>
    watermark ? <SlideWrapper watermark={watermark}>{el}</SlideWrapper> : el;

  const slides: DeckSlide[] = [];
  slides.push({ key: "cover", label: "Portada", accent: "green", element: wm(<CoverSlide proposal={proposal} />) });
  // Narrative (Context → Problems → Solutions) always lands before the
  // price so the client reads the framing first. Each block only renders
  // if it has content, so an empty proposal still flows naturally.
  if (proposal.context_markdown) {
    slides.push({ key: "context", label: "Contexto", accent: "white", element: wm(<ContextSlide proposal={proposal} />) });
  }
  if (proposal.problems.length > 0) {
    slides.push({
      key: "problems",
      label: "Retos",
      accent: "zinc",
      element: wm(
        <KeyPointsListSlide
          label="Retos detectados"
          title="Lo que queremos resolver"
          items={proposal.problems}
          accent="zinc"
          badgeVariant="muted"
        />,
      ),
    });
  }
  if (proposal.solutions.length > 0) {
    slides.push({
      key: "solutions",
      label: "Solución",
      accent: "white",
      element: wm(
        <KeyPointsListSlide
          label="Nuestra propuesta"
          title="Cómo lo abordamos"
          items={proposal.solutions}
          accent="white"
          badgeVariant="brand"
        />,
      ),
    });
  }
  if (team.length > 0) {
    slides.push({ key: "team", label: "Equipo", accent: "white", element: wm(<TeamSlide team={team} />) });
  }
  if (items.length > 0) {
    slides.push({ key: "services", label: "Servicios", accent: "zinc", element: wm(<ServicesSlide items={items} />) });
    const pricing = items.length > 3
      ? <PricingBarChart proposal={proposal} items={items} />
      : <PricingSlide proposal={proposal} items={items} />;
    slides.push({ key: "pricing", label: "Inversión", accent: "white", element: wm(pricing) });
  }
  if (proposal.terms) {
    slides.push({ key: "terms", label: "Condiciones", accent: "zinc", element: wm(<TermsSlide proposal={proposal} />) });
  }
  slides.push({ key: "closing", label: "Cierre", accent: "green", element: wm(<ClosingSlide proposal={proposal} token={token} />) });
  return slides;
}
