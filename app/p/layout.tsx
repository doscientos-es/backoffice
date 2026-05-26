import { Logo } from "@/components/branding";
import Link from "next/link";

export const metadata = {
  title: "Portal · doscientos",
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-100 dark:bg-zinc-950">
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-6">
          <Link href="/" aria-label="doscientos">
            <Logo size="md" />
          </Link>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">Documento privado</span>
        </div>
      </header>

      <main className="flex-1 py-10 px-6">
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </main>

      <footer className="bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex h-11 w-full max-w-3xl items-center justify-between px-6 text-xs text-zinc-400 dark:text-zinc-600">
          <span>© {new Date().getFullYear()} doscientos</span>
          <span>No compartas este enlace</span>
        </div>
      </footer>
    </div>
  );
}
