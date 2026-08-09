"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Downloads the accounting CSV for the selected calendar month. */
export function MonthlyRegisterExport() {
  const [month, setMonth] = useState(currentMonth);
  const href = `/api/invoices/libro-registro?month=${month}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="month"
        value={month}
        max={currentMonth()}
        onChange={(event) => setMonth(event.target.value)}
        className="h-8 w-40"
        aria-label="Mes de facturas a descargar"
      />
      <Button variant="outline" size="sm" asChild disabled={!month}>
        <a href={href} download={`facturas-${month}.csv`}>
          <Download className="mr-2 h-4 w-4" />
          Descargar mes
        </a>
      </Button>
    </div>
  );
}
