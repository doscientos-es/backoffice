import { listQuarterlyAdvisorDeliveries } from "@/lib/exports/quarterly-advisor";
import {
  madridToday,
  QUARTERLY_ADVISOR_EMAIL,
  quarterlyHandoff,
  recentClosedQuarters,
} from "@/lib/finance/quarterly-handoff";

import { QuarterlyHandoffCard } from "./quarterly-handoff-card";

/** Quarterly register hand-off to the advisor: reminder, Excel downloads and email dialog. */
export async function QuarterlyHandoff() {
  const today = madridToday();
  const deliveries = await listQuarterlyAdvisorDeliveries(24);
  const sent = deliveries.filter((delivery) => !delivery.mocked);
  const lastSentAt = (year: number, quarter: number) =>
    sent.find((delivery) => delivery.year === year && delivery.quarter === quarter)?.created_at ??
    null;

  const handoff = quarterlyHandoff(today, (period) =>
    Boolean(lastSentAt(period.year, period.quarter)),
  );
  const quarters = recentClosedQuarters(today).map((period) => ({
    year: period.year,
    quarter: period.quarter,
    label: period.label,
    sentAt: lastSentAt(period.year, period.quarter),
  }));

  return (
    <QuarterlyHandoffCard
      handoff={handoff}
      quarters={quarters}
      advisorEmail={QUARTERLY_ADVISOR_EMAIL}
    />
  );
}
