import { MobileNav } from "@/components/layout/mobile-nav";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { TimerWidget } from "@/components/layout/timer-widget";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import type { CurrentUser } from "@/lib/auth";

export function Topbar({ user }: { user: CurrentUser }) {
  const verifactuMode = (process.env.VERIFACTU_ENV ?? "mock").toUpperCase();
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between gap-3 border-b border-[color:var(--border)] bg-background/80 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-2">
        <MobileNav />
        <div className="flex items-center gap-2 text-xs text-[color:var(--text-muted)]">
          <span className="hidden sm:inline">Verifactu</span>
          <Badge
            variant={
              verifactuMode === "PROD" ? "success" : verifactuMode === "TEST" ? "warning" : "neutral"
            }
          >
            {verifactuMode}
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <TimerWidget memberId={user.id} />
        <NotificationsBell memberId={user.id} />
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
