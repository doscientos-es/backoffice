/**
 * Shared types for the inicio (dashboard) widgets.
 * Keeping them in `lib/` decouples the data layer from the UI components.
 */

export type DashboardRange = "7d" | "30d" | "90d" | "ytd";

export type DateWindow = {
  from: Date;
  to: Date;
};

export type DateRange = {
  current: DateWindow;
  previous: DateWindow;
};

export type TrendDirection = "up" | "down" | "flat";

export type Trend = {
  delta: number; // signed percentage, e.g. 12.5 means +12.5%
  direction: TrendDirection;
};

export type ReminderRow = {
  id: string;
  title: string;
  remind_at: string;
};

export type VerifactuPendingRow = {
  id: string;
  full_number: string | null;
  verifactu_status: "pending" | "error" | "rejected";
  verifactu_error: string | null;
  client_name: string | null;
};

export type OverdueInvoiceRow = {
  id: string;
  full_number: string | null;
  due_date: string | null;
  total: number;
  client_name: string | null;
};

export type RevenuePoint = {
  month: string; // localized short month label, e.g. "ene"
  current: number;
  previous: number;
};

export type DashboardKpis = {
  leadsNew: number;
  leadsNewPrev: number;
  proposalsOpen: number;
  proposalsOpenPrev: number;
  overdueCount: number;
  monthRevenue: number;
  monthRevenuePrev: number;
  pipelineValue: number;
  conversionRate: number; // 0..1
  conversionRatePrev: number;
};

export type AvisosData = {
  reminders: ReminderRow[];
  verifactuPending: VerifactuPendingRow[];
  overdueInvoices: OverdueInvoiceRow[];
  certExpiresAt: string | null;
};
