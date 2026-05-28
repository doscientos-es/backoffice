export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: unknown[] }>;
    Views: { [_ in never]: never };
    Functions: {
      current_member_role: { Args: never; Returns: Database["public"]["Enums"]["member_role"] };
      is_team_member: { Args: never; Returns: boolean };
    };
    Enums: {
      expense_category:
        | "hosting"
        | "domain"
        | "service"
        | "software"
        | "hardware"
        | "office"
        | "marketing"
        | "professional"
        | "travel"
        | "taxes"
        | "salary"
        | "other";
      expense_recurrence: "none" | "monthly" | "quarterly" | "yearly";
      expense_status: "pending" | "paid" | "cancelled";
      interaction_type:
        | "email_sent"
        | "email_delivered"
        | "email_opened"
        | "email_clicked"
        | "email_bounced"
        | "email_complained"
        | "call"
        | "meeting"
        | "note"
        | "portal_view"
        | "portal_accept"
        | "portal_reject"
        | "email_received"
        | "status_change";
      internal_doc_category:
        | "legal"
        | "hr"
        | "finance"
        | "templates"
        | "policies"
        | "meetings"
        | "other";
      invoice_status: "draft" | "issued" | "paid" | "overdue" | "cancelled";
      invoice_type: "F1" | "F2" | "F3" | "R1" | "R2" | "R3" | "R4" | "R5";
      lead_status:
        | "new"
        | "qualifying"
        | "quoted"
        | "won"
        | "lost"
        | "archived"
        | "not_interested";
      lead_temperature: "hot" | "warm" | "cold";
      member_role: "owner" | "admin" | "member" | "viewer";
      project_status: "planning" | "active" | "on_hold" | "done" | "cancelled";
      proposal_status:
        | "draft"
        | "sent"
        | "viewed"
        | "accepted"
        | "rejected"
        | "expired";
      proposal_viewer_type: "team" | "client";
      verifactu_status:
        | "pending"
        | "submitted"
        | "accepted"
        | "rejected"
        | "excluded";
    };
    CompositeTypes: { [_ in never]: never };
  };
};
