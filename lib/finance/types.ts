import type { ExpenseCategory, ExpenseStatus, MonthlyPoint } from "./helpers";

export type FinanceOverview = {
  series: MonthlyPoint[];
  revenueMonth: number;
  expenseMonth: number;
  netMonth: number;
  margin: number | null;
  topCategories: [ExpenseCategory, number][];
  recentExpenses: ExpenseRow[];
  recentInvoices: InvoiceRow[];
};

export type ExpenseRow = {
  id: string;
  vendor: string;
  category: ExpenseCategory;
  total: number;
  expense_date: string;
  status: ExpenseStatus;
};

export type InvoiceRow = {
  id: string;
  full_number: string | null;
  total: number;
  issue_date: string;
  client_name: string | null;
};
