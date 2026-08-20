import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { SettingsNav } from "./settings-nav";

export const metadata: Metadata = { title: "Ajustes · doscientos" };

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const canManageTeam = user.role === "owner" || user.role === "admin";

  return (
    <div className="mx-auto grid w-full gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start">
      <SettingsNav canManageTeam={canManageTeam} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
