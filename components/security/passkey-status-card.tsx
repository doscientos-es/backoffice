import { Fingerprint, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Shows the account-specific passkey status without exposing credential metadata. */
export function PasskeyStatusCard({ configured }: { configured: boolean }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              {configured ? <ShieldCheck className="size-5" /> : <Fingerprint className="size-5" />}
            </div>
            <div>
              <CardTitle>Biometría y passkeys</CardTitle>
              <CardDescription>
                {configured
                  ? "Tu cuenta puede confirmar acciones sensibles con el bloqueo del dispositivo."
                  : "Protege las acciones sensibles con Face ID, Windows Hello, Touch ID o el PIN del dispositivo."}
              </CardDescription>
            </div>
          </div>
          <Badge variant={configured ? "success" : "neutral"} className="shrink-0">
            {configured ? "Configurada" : "Pendiente"}
          </Badge>
        </div>
      </CardHeader>
      {!configured ? (
        <CardContent className="pt-0">
          <Button asChild size="sm">
            <Link href="/vault?setup=passkey">
              <Fingerprint className="size-3.5" /> Configurar biometría
            </Link>
          </Button>
        </CardContent>
      ) : null}
    </Card>
  );
}
