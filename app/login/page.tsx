import { AuthShell } from "@/components/auth/auth-shell";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { Metadata } from "next";

export const metadata:Metadata = { title: "Entrar · doscientos backoffice" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Bienvenido"
      description="Accede al backoffice de doscientos."
      footer={<>Backoffice interno · Acceso restringido al equipo.</>}
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
