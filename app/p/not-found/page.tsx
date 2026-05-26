import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Documento no encontrado · doscientos" };

export default function PortalNotFound() {
  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Documento no disponible</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted">
        <p>
          El enlace ha caducado o no es válido. Contacta con quien te lo envió para recibir uno
          nuevo.
        </p>
      </CardContent>
    </Card>
  );
}
