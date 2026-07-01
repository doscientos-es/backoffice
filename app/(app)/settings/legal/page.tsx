import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { serverEnv } from "@/lib/env";
import { ExternalLink, Shield } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Legal / Verifactu · doscientos" };

export default async function LegalPage() {
  const env = serverEnv();
  const softwareName = env.VERIFACTU_SOFTWARE_NAME;
  const softwareId = env.VERIFACTU_SOFTWARE_ID;
  const softwareVersion = env.VERIFACTU_SOFTWARE_VERSION;
  const verifactuEnv = env.VERIFACTU_ENV;

  const today = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Legal / Verifactu"
        description="Declaración Responsable del Sistema Informático de Facturación (SIF) según RD 1007/2023 y Orden HAC/1177/2024."
      />

      {/* Estado actual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Estado del SIF
          </CardTitle>
          <CardDescription>Configuración activa del sistema Verifactu.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">Nombre del sistema</dt>
              <dd className="font-medium">{softwareName}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">IdSistemaInformatico</dt>
              <dd className="font-mono font-medium">{softwareId}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">Versión</dt>
              <dd className="font-medium">{softwareVersion}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">Entorno Verifactu</dt>
              <dd>
                <Badge
                  variant={
                    verifactuEnv === "prod"
                      ? "default"
                      : verifactuEnv === "test"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {verifactuEnv}
                </Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Declaración Responsable */}
      <Card>
        <CardHeader>
          <CardTitle>Declaración Responsable</CardTitle>
          <CardDescription>
            Art. 13 RD 1007/2023 — debe estar accesible dentro del SIF en cada versión.
          </CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
          <p className="text-muted-foreground text-xs mb-4">Generado el {today}</p>

          <h3 className="font-semibold text-base mb-2">
            1. Identificación del productor del SIF
          </h3>
          <ul className="list-none space-y-1 pl-0 mb-4">
            <li><span className="text-muted-foreground">Denominación social:</span> Doscientos Estudio S.L.</li>
            <li><span className="text-muted-foreground">Sitio web:</span>{" "}
              <a href="https://doscientos.es" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                doscientos.es <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li><span className="text-muted-foreground">Email de contacto:</span> hola@doscientos.es</li>
          </ul>

          <h3 className="font-semibold text-base mb-2">
            2. Identificación del SIF
          </h3>
          <ul className="list-none space-y-1 pl-0 mb-4">
            <li><span className="text-muted-foreground">Nombre:</span> {softwareName}</li>
            <li><span className="text-muted-foreground">IdSistemaInformatico:</span> <code className="font-mono">{softwareId}</code></li>
            <li><span className="text-muted-foreground">Versión:</span> {softwareVersion}</li>
            <li><span className="text-muted-foreground">Modalidad:</span> VERI*FACTU (emisión de facturas verificables)</li>
          </ul>

          <h3 className="font-semibold text-base mb-2">3. Declaración de cumplimiento</h3>
          <p className="mb-4">
            El productor declara, bajo su responsabilidad, que el sistema informático de
            facturación identificado en el apartado 2 cumple las especificaciones técnicas
            y funcionales contenidas en:
          </p>
          <ul className="list-disc pl-5 space-y-1 mb-4">
            <li>Real Decreto 1007/2023, de 5 de diciembre (RRSIF)</li>
            <li>Orden HAC/1177/2024, de 17 de octubre</li>
          </ul>
          <p className="mb-4">
            En concreto, el sistema garantiza la <strong>integridad, inalterabilidad,
              conservación, accesibilidad, legibilidad, trazabilidad e inalterabilidad</strong> de
            los registros de facturación, mediante encadenamiento criptográfico (hash SHA-256)
            y envío en tiempo real a la AEAT en modalidad VERI*FACTU.
          </p>

          <h3 className="font-semibold text-base mb-2">4. Recursos adicionales</h3>
          <ul className="list-none space-y-1 pl-0">
            <li>
              <a
                href="https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Información AEAT sobre Verifactu <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>
              <a
                href="https://www.boe.es/buscar/act.php?id=BOE-A-2023-24840"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                RD 1007/2023 en el BOE <ExternalLink className="h-3 w-3" />
              </a>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
