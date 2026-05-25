import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export type BackLinkProps = {
  href: string;
  label: string;
};

export function BackLink({ href, label }: BackLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs text-[color:var(--text-muted)] transition-colors hover:text-[color:var(--text-primary)]"
    >
      <ChevronLeft className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
