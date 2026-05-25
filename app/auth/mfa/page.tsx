import { MfaForm } from "./mfa-form";

export const metadata = { title: "2FA · doscientos" };

export default function MfaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--background)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Verificación 2FA</h1>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Introduce el código de tu app autenticadora.
          </p>
        </div>
        <MfaForm />
      </div>
    </main>
  );
}
