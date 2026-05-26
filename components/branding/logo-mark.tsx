import { cn } from "@/lib/utils";
import type { SVGProps } from "react";

export type LogoMarkProps = Omit<SVGProps<SVGSVGElement>, "viewBox" | "xmlns"> & {
  /** Pixel size applied to both width and height. */
  size?: number;
  /** Accessible title; when omitted the mark is treated as decorative. */
  title?: string;
};

/**
 * Pure SVG mark for the doscientos brand. Uses `currentColor` so callers
 * control the tint via Tailwind text utilities or inline `color`.
 */
export function LogoMark({ size = 24, title, className, ...props }: LogoMarkProps) {
  const decorative = !title;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      xmlns="http://www.w3.org/2000/svg"
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
      className={cn("shrink-0", className)}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M30 88.0355C40.3711 88.0355 50.3174 92.1554 57.6508 99.4889C64.9843 106.822 69.1041 116.769 69.1041 127.14C69.1041 137.511 64.9843 147.457 57.6508 154.79C50.3174 162.124 40.3711 166.244 30 166.244L30 88.0355Z"
        fill="currentColor"
      />
      <circle cx="115.632" cy="127.14" r="39.1041" fill="currentColor" />
      <circle cx="201.265" cy="127.14" r="39.1041" fill="currentColor" />
    </svg>
  );
}
