import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Verificación · doscientos" };

type SearchParams = Promise<{ nif?: string; numserie?: string; fecha?: string; importe?: string }>;

export default async function VerifyPage({ searchParams }: { searchParams: SearchParams }) {
  const p = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verificación de factura</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="mb-4 text-muted">
            Modo MOCK Verifactu (entorno interno). Estos datos provienen del QR de la factura.
          </p>
          <Row label="NIF emisor" value={p.nif} />
          <Row label="Nº serie" value={p.numserie} />
          <Row label="Fecha emisión" value={p.fecha} />
          <Row label="Importe" value={p.importe ? `${p.importe} €` : undefined} />
        </CardContent>
      </Card>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-2 py-1.5 border-b last:border-b-0 border-border">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-primary" data-tabular>
        {value ?? "—"}
      </span>
    </div>
  );
}
