import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { SettingsNav } from "./settings-nav";

export const metadata: Metadata = { title: "Ajustes · doscientos" };

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const canManageTeam = user.role === "owner" || user.role === "admin";

  return (
    <div className="mx-auto flex w-full max-md:flex-col gap-6">
      <SettingsNav canManageTeam={canManageTeam} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
