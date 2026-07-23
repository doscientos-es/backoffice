import { PLATFORM_LABELS, type SocialPlatform } from "@/lib/social/core";
import { cn } from "@/lib/utils";
import { Facebook, Instagram, Linkedin, Store } from "lucide-react";
import type { ComponentType } from "react";

/**
 * Social Hub — platform presentation.
 *
 * Single source of truth for each network's icon and brand tint in the UI. Kept
 * out of the domain (lib/social/core) because it's pure presentation; the domain
 * only owns the `SocialPlatform` union and `PLATFORM_LABELS`.
 */

const ICONS: Record<SocialPlatform, ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  google_business_profile: Store,
};

/** Brand-tinted chip classes per network (subtle, theme-aware). */
const TINTS: Record<SocialPlatform, string> = {
  instagram: "bg-pink-500/10 text-pink-600 dark:text-pink-300",
  facebook: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
  linkedin: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  google_business_profile: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

export function PlatformIcon({
  platform,
  className,
}: {
  platform: SocialPlatform;
  className?: string;
}) {
  const Icon = ICONS[platform];
  return <Icon className={className} />;
}

/** Compact platform pill: tinted icon + label. Used across lists and detail. */
export function PlatformChip({
  platform,
  className,
}: {
  platform: SocialPlatform;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        TINTS[platform],
        className,
      )}
    >
      <PlatformIcon platform={platform} className="size-3" />
      {PLATFORM_LABELS[platform]}
    </span>
  );
}
