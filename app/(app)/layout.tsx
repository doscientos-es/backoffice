import { Logo } from "@/components/branding";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const verifactuMode = (process.env.VERIFACTU_ENV ?? "mock").toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar user={user} verifactuMode={verifactuMode} />
      <div className="flex flex-1 flex-col min-h-0">
        {/* Mobile Header (Topbar replacement) */}
        <header className="flex h-12 items-center justify-between border-b border-border bg-card px-4 md:hidden">
          <MobileNav user={user} verifactuMode={verifactuMode} />
          <Logo size="sm" />
          <div className="w-8" /> {/* Spacer */}
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
