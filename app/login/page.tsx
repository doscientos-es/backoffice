import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar · doscientos backoffice" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--background)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--text-primary)]">
            doscientos
          </h1>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">Backoffice CRM interno</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
