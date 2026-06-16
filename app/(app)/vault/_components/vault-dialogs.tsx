"use client";

import { Field, FieldLabel } from "@/components/ui/field";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { setVaultPassword, unlockVault } from "../actions";

/** Dialog body: unlock the vault with master password */
export function UnlockForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  /** Called after a successful unlock instead of reloading the page. */
  onSuccess?: () => void;
}) {
  const feedback = useFormFeedback();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    feedback.setPending();
    const result = await unlockVault(fd);
    if (result.ok) {
      feedback.setSuccess("Bóveda desbloqueada");
      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
        else window.location.reload();
      }, 500);
    } else {
      feedback.setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="unlock-pw">Contraseña maestra</FieldLabel>
        <Input
          id="unlock-pw"
          name="password"
          type="password"
          autoFocus
          required
          autoComplete="current-password"
          placeholder="••••••••"
        />
      </Field>
      <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
        <FormFeedback state={feedback.state} successLabel="Desbloqueada" />
        <SubmitButton loading={feedback.pending} pendingLabel="Verificando…">
          Desbloquear
        </SubmitButton>
      </div>
    </form>
  );
}

/** Dialog body: set / change master password */
export function SetPasswordForm({
  hasPassword,
  onClose,
}: {
  hasPassword: boolean;
  onClose: () => void;
}) {
  const feedback = useFormFeedback();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pw = fd.get("password") as string;
    const confirm = fd.get("confirm") as string;
    if (pw !== confirm) { feedback.setError("Las contraseñas no coinciden"); return; }
    feedback.setPending();
    const result = await setVaultPassword(fd);
    if (result.ok) {
      feedback.setSuccess("Contraseña guardada");
      setTimeout(() => { onClose(); window.location.reload(); }, 600);
    } else {
      feedback.setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {hasPassword && (
        <Field>
          <FieldLabel htmlFor="sp-current">Contraseña actual</FieldLabel>
          <Input
            id="sp-current"
            name="current_password"
            type="password"
            required
            autoFocus
            autoComplete="current-password"
          />
        </Field>
      )}
      <Field>
        <FieldLabel htmlFor="sp-new">
          {hasPassword ? "Nueva contraseña" : "Contraseña maestra"} <span className="text-destructive">*</span>
        </FieldLabel>
        <Input
          id="sp-new"
          name="password"
          type="password"
          required
          minLength={8}
          autoFocus={!hasPassword}
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="sp-confirm">Confirmar contraseña <span className="text-destructive">*</span></FieldLabel>
        <Input
          id="sp-confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </Field>
      <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
        <FormFeedback state={feedback.state} successLabel="Guardada" />
        <SubmitButton loading={feedback.pending} pendingLabel="Guardando…">
          {hasPassword ? "Cambiar contraseña" : "Activar bóveda"}
        </SubmitButton>
      </div>
    </form>
  );
}
