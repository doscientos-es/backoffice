import { requireUser } from "@/lib/auth";
import { SettingsNav } from "./settings-nav";

export const metadata = { title: "Ajustes · doscientos" };

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const canManageTeam = user.role === "owner" || user.role === "admin";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 md:flex-row md:gap-10">
      <SettingsNav canManageTeam={canManageTeam} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
