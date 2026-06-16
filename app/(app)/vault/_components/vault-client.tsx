"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty-state";
import { VAULT_SERVICE_LABELS, type VaultService } from "@/lib/schemas/vault";
import { cn } from "@/lib/utils";
import { Copy, Eye, EyeOff, Lock, LockOpen, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteVaultItem, lockVault, revealVaultSecret } from "../actions";
import { SetPasswordForm, UnlockForm } from "./vault-dialogs";
import { VaultItemForm } from "./vault-item-dialog";

type VaultItem = {
  id: string;
  name: string;
  service: string;
  username: string | null;
  notes: string | null;
  is_sensitive: boolean;
  expires_at: string | null;
  client_id: string | null;
  created_at: string;
};
type Client = { id: string; name: string };
type Dialog_ = "add" | "edit" | "unlock" | "setPassword" | null;

const SERVICE_COLORS: Record<string, string> = {
  hosting: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  domain: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  cms: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  database: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  api: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  email: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  ssh: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  vpn: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  other: "bg-muted text-muted-foreground",
};

export function VaultClient({
  items,
  passwordSet,
  unlocked,
  clients,
}: {
  items: VaultItem[];
  passwordSet: boolean;
  unlocked: boolean;
  clients: Client[];
}) {
  const [dialog, setDialog] = useState<Dialog_>(null);
  const [editItem, setEditItem] = useState<VaultItem | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function openEdit(item: VaultItem) {
    setEditItem(item);
    setDialog("edit");
  }

  function handleReveal(item: VaultItem) {
    if (revealed[item.id]) {
      setRevealed((r) => {
        const n = { ...r };
        delete n[item.id];
        return n;
      });
      return;
    }
    if (item.is_sensitive && !unlocked) {
      setDialog("unlock");
      return;
    }
    startTransition(async () => {
      const r = await revealVaultSecret({ id: item.id, is_sensitive: item.is_sensitive });
      if (r.ok && "secret" in r) setRevealed((rv) => ({ ...rv, [item.id]: r.secret as string }));
    });
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta credencial? Esta acción no se puede deshacer.")) return;
    startTransition(async () => {
      await deleteVaultItem({ id });
    });
  }

  async function handleLock() {
    await lockVault();
    window.location.reload();
  }

  const expiresLabel = (d: string | null) => {
    if (!d) return null;
    const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
    if (diff < 0)
      return (
        <Badge variant="destructive" className="text-[10px] px-1">
          Caducado
        </Badge>
      );
    if (diff <= 30)
      return (
        <Badge variant="warning" className="text-[10px] px-1">
          {diff}d
        </Badge>
      );
    return (
      <Badge variant="neutral" className="text-[10px] px-1">
        {d}
      </Badge>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bóveda"
        description="Credenciales y secretos de clientes, cifrados con AES-256-GCM."
        actions={
          <div className="flex items-center gap-2">
            {passwordSet ? (
              unlocked ? (
                <Button variant="outline" size="sm" onClick={handleLock}>
                  <LockOpen className="size-3.5" /> Bloquear
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setDialog("unlock")}>
                  <Lock className="size-3.5" /> Desbloquear
                </Button>
              )
            ) : (
              <Button variant="outline" size="sm" onClick={() => setDialog("setPassword")}>
                <ShieldAlert className="size-3.5" /> Activar contraseña
              </Button>
            )}
            <Button size="sm" onClick={() => setDialog("add")}>
              <Plus className="size-3.5" /> Añadir
            </Button>
          </div>
        }
      />

      {passwordSet && !unlocked && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <Lock className="size-4 shrink-0" />
          <span>
            Los secretos sensibles están ocultos.{" "}
            <button
              type="button"
              className="underline hover:no-underline"
              onClick={() => setDialog("unlock")}
            >
              Desbloquear bóveda
            </button>
          </span>
        </div>
      )}

      <Card>
        <CardContent className="px-0 pt-0">
          {items.length === 0 ? (
            <Empty className="border-0 py-10">
              <EmptyHeader>
                <EmptyTitle>Sin credenciales aún</EmptyTitle>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={() => setDialog("add")}>
                  <Plus className="size-3.5" /> Añadir primera credencial
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                    {["Nombre", "Servicio", "Usuario", "Secreto", "Caduca", ""].map((h, i) => (
                      <th
                        key={i}
                        className={cn(
                          "px-5 py-3 font-medium tracking-wide text-left",
                          i === 5 && "w-20 text-right",
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {items.map((item) => {
                    const isRevealed = !!revealed[item.id];
                    return (
                      <tr key={item.id} className="group hover:bg-muted/40 transition-colors">
                        <td className="px-5 py-3 font-medium text-foreground">
                          <span className="flex items-center gap-1.5">
                            {item.name}
                            {item.is_sensitive && (
                              <Lock className="size-3 text-muted-foreground/60 shrink-0" />
                            )}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-medium",
                              SERVICE_COLORS[item.service] ?? SERVICE_COLORS.other,
                            )}
                          >
                            {VAULT_SERVICE_LABELS[item.service as VaultService] ?? item.service}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground font-mono text-xs">
                          {item.username ?? <span className="opacity-30">—</span>}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "font-mono text-xs",
                                isRevealed
                                  ? "text-foreground select-all"
                                  : "text-muted-foreground tracking-widest",
                              )}
                            >
                              {isRevealed ? revealed[item.id] : "••••••••"}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleReveal(item)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              aria-label={isRevealed ? "Ocultar" : "Revelar"}
                            >
                              {isRevealed ? (
                                <EyeOff className="size-3.5" />
                              ) : (
                                <Eye className="size-3.5" />
                              )}
                            </button>
                            {isRevealed && (
                              <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(revealed[item.id]!)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                aria-label="Copiar"
                              >
                                <Copy className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3">{expiresLabel(item.expires_at)}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => openEdit(item)}
                              aria-label="Editar"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleDelete(item.id)}
                              aria-label="Eliminar"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit dialog */}
      <Dialog
        open={dialog === "add" || dialog === "edit"}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialog === "edit" ? "Editar credencial" : "Nueva credencial"}
            </DialogTitle>
            <DialogDescription>
              Los secretos se cifran con AES-256-GCM antes de guardarse.
            </DialogDescription>
          </DialogHeader>
          <VaultItemForm
            item={editItem ?? undefined}
            clients={clients}
            onClose={() => setDialog(null)}
          />
        </DialogContent>
      </Dialog>

      {/* Unlock dialog */}
      <Dialog open={dialog === "unlock"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Desbloquear bóveda</DialogTitle>
            <DialogDescription>
              Introduce la contraseña maestra para acceder a los secretos sensibles. La sesión dura
              4 horas.
            </DialogDescription>
          </DialogHeader>
          <UnlockForm onClose={() => setDialog(null)} />
        </DialogContent>
      </Dialog>

      {/* Set password dialog */}
      <Dialog open={dialog === "setPassword"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {passwordSet ? "Cambiar contraseña maestra" : "Activar protección maestra"}
            </DialogTitle>
            <DialogDescription>
              {passwordSet
                ? "Verifica la contraseña actual antes de cambiarla."
                : "Define una contraseña para proteger los secretos sensibles. No se puede recuperar si la pierdes."}
            </DialogDescription>
          </DialogHeader>
          <SetPasswordForm hasPassword={passwordSet} onClose={() => setDialog(null)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
