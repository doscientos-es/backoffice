import { Logo } from "@/components/branding";
import { CommandPalette } from "@/components/layout/command-palette";
import { CommandPaletteTrigger } from "@/components/layout/command-palette-trigger";
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";
import { MobileNav } from "@/components/layout/mobile-nav";
import { QuickCreateButton } from "@/components/layout/quick-create-button";
import { ShortcutsDialog } from "@/components/layout/shortcuts-dialog";
import { Sidebar } from "@/components/layout/sidebar";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const verifactuMode = (process.env.VERIFACTU_ENV ?? "mock").toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar user={user} verifactuMode={verifactuMode} />
      <div className="flex flex-1 flex-col min-h-0 min-w-0">
        {/* Mobile Header (Topbar replacement) */}
        <header className="flex h-12 items-center justify-between border-b border-border bg-card px-4 md:hidden">
          <MobileNav user={user} verifactuMode={verifactuMode} />
          <Logo size="sm" />
          <CommandPaletteTrigger variant="icon" />
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">{children}</main>
      </div>
      <CommandPalette />
      <KeyboardShortcuts />
      <ShortcutsDialog />
      <QuickCreateButton />
    </div>
  );
}
