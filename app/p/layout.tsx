import Link from "next/link";

export const metadata = {
  title: "Portal · doscientos",
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
      <header className="border-b border-[color:var(--border)]">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center px-6">
          <Link href="/" className="text-sm font-semibold tracking-tight text-[color:var(--text-primary)]">
            doscientos
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto w-full max-w-4xl px-6 py-10">{children}</div>
      </main>
      <footer className="border-t border-[color:var(--border)]">
        <div className="mx-auto flex h-12 w-full max-w-4xl items-center justify-between px-6 text-xs text-[color:var(--text-muted)]">
          <span>© {new Date().getFullYear()} doscientos</span>
          <span>Documento privado — no compartas el enlace.</span>
        </div>
      </footer>
    </div>
  );
}
