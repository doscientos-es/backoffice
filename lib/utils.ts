import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEUR(value: number | string | null | undefined): string {
  if (value == null) return "—";
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = (Date.now() - d.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  if (diff < 60) return rtf.format(-Math.floor(diff), "second");
  if (diff < 3600) return rtf.format(-Math.floor(diff / 60), "minute");
  if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), "hour");
  if (diff < 2592000) return rtf.format(-Math.floor(diff / 86400), "day");
  if (diff < 31536000) return rtf.format(-Math.floor(diff / 2592000), "month");
  return rtf.format(-Math.floor(diff / 31536000), "year");
}

export function truncate(s: string | null | undefined, max: number): string {
  if (!s) return "";
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

const GITHUB_HANDLE_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/;

/**
 * Resolves the best avatar URL for a team member:
 * 1. Explicit `avatarUrl` if set
 * 2. GitHub avatar derived from a valid `githubHandle`
 * 3. `null` so the caller can render a fallback (initials)
 */
export function memberAvatarUrl(
  member: { avatarUrl?: string | null; githubHandle?: string | null },
  size = 64,
): string | null {
  if (member.avatarUrl) return member.avatarUrl;
  const handle = member.githubHandle?.trim();
  if (handle && GITHUB_HANDLE_RE.test(handle)) {
    return `https://github.com/${handle}.png?size=${size}`;
  }
  return null;
}
