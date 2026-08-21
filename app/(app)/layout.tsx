import { CallReminderWatcher } from "@/components/layout/call-reminder-watcher";
import { CommandPalette } from "@/components/layout/command-palette";
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";
import { NavProgress } from "@/components/layout/nav-progress";
import { QuickCreateButton } from "@/components/layout/quick-create-button";
import { ShortcutsDialog } from "@/components/layout/shortcuts-dialog";
import { Sidebar } from "@/components/layout/sidebar";
import { MfaSessionGate } from "@/components/security/mfa-session-gate";
import { hasAal2Session, requireUser } from "@/lib/auth";
import { isPublicDemoMode } from "@/lib/demo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const demoMode = isPublicDemoMode();
  const mfaVerified =
    user.role === "owner" || user.role === "admin" ? await hasAal2Session() : true;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar user={user} demoMode={demoMode} />
      <div className="flex flex-1 flex-col min-h-0 min-w-0">
        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">{children}</main>
      </div>
      <NavProgress />
      <CommandPalette />
      <KeyboardShortcuts />
      <ShortcutsDialog />
      <QuickCreateButton />
      <CallReminderWatcher />
      <MfaSessionGate memberRole={user.role} mfaVerified={mfaVerified} />
    </div>
  );
}
