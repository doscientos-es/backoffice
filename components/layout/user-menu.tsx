"use client";

import { Button } from "@/components/ui/button";
import type { CurrentUser } from "@/lib/auth";
import { getBrowserClient } from "@/lib/supabase/browser";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function UserMenu({ user }: { user: CurrentUser }) {
  const router = useRouter();

  async function signOut() {
    const supabase = getBrowserClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <div className="hidden text-right md:block">
        <div className="text-xs font-medium text-[color:var(--text-primary)]">{user.name}</div>
        <div className="text-[10px] text-[color:var(--text-muted)]">{user.role}</div>
      </div>
      <Button variant="ghost" size="icon" aria-label="Cerrar sesión" onClick={signOut}>
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
