/**
 * Shared types for the inicio (dashboard) widgets.
 * Keeping them in `lib/` decouples the data layer from the UI components.
 */

import type { LeadStatus, TaskPriority, TaskStatus } from "@/lib/status";

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

// ---------------------------------------------------------------------------
// Company goals
// ---------------------------------------------------------------------------

export type GoalMetric = "leads_new" | "revenue" | "conversion_rate";

/** Map of metric → raw numeric target. Only metrics with a set goal appear. */
export type CompanyGoals = Partial<Record<GoalMetric, number>>;

// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Week stats (personal progress — shown in "Tu día")
// ---------------------------------------------------------------------------

export type WeekStats = {
  /** Tasks marked as done this calendar week (Mon–Sun). */
  tasksCompleted: number;
  /** Active leads owned by the member that were updated this week. */
  leadsAttended: number;
  /** Consecutive days (looking back from today) with at least one task completed. */
  streakDays: number;
};

// ---------------------------------------------------------------------------

/**
 * "Tu día" — the personal, action-oriented layer of the dashboard. Surfaces
 * what the logged-in member should act on today: their open tasks, the leads
 * they own that need follow-up, and unassigned leads they can claim.
 */
export type MyTaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  contextLabel: string | null; // project or lead name the task belongs to
};

export type ActionLeadRow = {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  status: LeadStatus;
  /** Timestamp used for relative time: last update (my leads) or creation (unassigned). */
  since: string;
};

export type MyDayData = {
  tasks: MyTaskRow[];
  myLeads: ActionLeadRow[];
  unassignedLeads: ActionLeadRow[];
  weekStats: WeekStats;
};

/**
 * Snapshot of Accounts Receivable for the dashboard tile: total outstanding
 * (issued + overdue), how much of it is overdue, and how much was already
 * collected within the current calendar month.
 */
export type AccountsReceivable = {
  pendingTotal: number;
  pendingCount: number;
  overdueTotal: number;
  overdueCount: number;
  paidMonthTotal: number;
  paidMonthCount: number;
};

/**
 * Current-month finance snapshot for the dashboard tile: invoiced revenue,
 * registered expenses, the resulting net and the dominant expense category.
 */
export type MonthFinanceSummary = {
  revenueMonth: number;
  expenseMonth: number;
  netMonth: number;
  margin: number | null;
  topCategory: { category: string; label: string; total: number } | null;
};
