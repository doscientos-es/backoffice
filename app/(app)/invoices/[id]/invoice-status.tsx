import { StatusBadge } from "@/components/ui/status-badge";
import { INVOICE_STATUS, VERIFACTU_STATUS } from "@/lib/status";
import { VerifactuIssueDetailsButton } from "./verifactu-issue-dialog";

export function InvoiceStatus({
  status,
  verifactuStatus,
  verifactuError,
}: {
  status: string;
  verifactuStatus: string;
  verifactuError: string | null;
}) {
  const hasFiscalProblem = verifactuStatus === "error" || verifactuStatus === "rejected";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <StatusBadge meta={INVOICE_STATUS} value={status} />
      <StatusBadge meta={VERIFACTU_STATUS} value={verifactuStatus} labelPrefix="Verifactu · " />
      {hasFiscalProblem ? (
        <VerifactuIssueDetailsButton
          status={verifactuStatus as "error" | "rejected"}
          error={verifactuError}
        />
      ) : null}
    </div>
  );
}
