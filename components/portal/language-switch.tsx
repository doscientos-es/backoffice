"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import type { PortalLanguage } from "@/lib/portal/language";

const LANGUAGES: Array<{ value: PortalLanguage; label: string }> = [
  { value: "es", label: "ES" },
  { value: "ca", label: "CA" },
  { value: "en", label: "EN" },
];

function browserLanguage(): PortalLanguage {
  const preferences = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const preference of preferences) {
    const language = preference.toLowerCase().split("-")[0];
    if (language === "ca" || language === "en" || language === "es") return language;
  }
  return "es";
}

export function PortalLanguageSwitch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const language = (searchParams.get("lang") as PortalLanguage | null) ?? "es";

  useEffect(() => {
    if (searchParams.has("lang")) return;
    const preferred = browserLanguage();
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", preferred);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  return (
    <nav
      aria-label="Idioma / Language / Llengua"
      className="inline-flex items-center gap-0.5 rounded-full border border-zinc-200 bg-white/90 p-1 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90"
    >
      {LANGUAGES.map(({ value, label }) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("lang", value);
        const href = `${pathname}?${params.toString()}`;
        return (
          <a
            key={value}
            href={href}
            lang={value}
            aria-current={language === value ? "true" : undefined}
            aria-label={value === "es" ? "Español" : value === "ca" ? "Català" : "English"}
            className={`rounded-full px-2.5 py-1.5 font-semibold transition-colors ${language === value ? "bg-[#2A4227] text-white dark:bg-[#9CC196] dark:text-zinc-950" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"}`}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}
