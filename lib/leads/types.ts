import type { LeadStatus } from "@/lib/status";

export const LEAD_LIST_PAGE_SIZE = 25;
export const LEAD_BOARD_LIMIT = 500;
export const RECENT_INTERACTIONS_PER_LEAD = 3;

export type LeadInteraction = {
  id: string;
  type: string;
  subject: string | null;
  body: string | null;
  created_at: string;
};

export type LeadListItem = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  notes: string | null;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
  estimated_value: number | null;
  ai_summary: string | null;
  ai_updated_at: string | null;
  recent_interactions: LeadInteraction[];
};

export type LeadListView = "board" | "list";

export type LeadListParams = {
  view: LeadListView;
  q: string;
  status: LeadStatus | null;
  source: string | null;
  page: number;
};

export type LeadListResult = {
  leads: LeadListItem[];
  count: number;
  error: string | null;
};

export type LeadDetailAiTemperature = "hot" | "warm" | "cold";

export type LeadDetail = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  status: LeadStatus;
  notes: string | null;
  estimated_value: number | null;
  created_at: string;
  updated_at: string | null;
  ai_summary: string | null;
  ai_suggested_next_step: string | null;
  ai_temperature: LeadDetailAiTemperature | null;
  ai_confidence: number | null;
  ai_updated_at: string | null;
  lost_reason: string | null;
  lost_at: string | null;
};

export type LeadDetailInteraction = LeadInteraction & {
  payload: unknown;
};

export type LeadDetailResult = {
  lead: LeadDetail;
  interactions: LeadDetailInteraction[];
  linkedClientId: string | null;
};

export type LeadConvertSeed = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
};

export type LeadConvertResult = {
  lead: LeadConvertSeed;
  existingClientId: string | null;
};
