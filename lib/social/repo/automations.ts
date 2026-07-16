import { normalizeAutomationText } from "@/lib/social/automation/matcher";
import type {
  AutomationRule,
  CreateAutomationRuleInput,
  MetaPlatform,
} from "@/lib/social/automation/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

interface AutomationRuleRow {
  id: string;
  post_id: string | null;
  platform: string;
  keyword: string;
  keyword_normalized: string;
  public_reply: string;
  private_message: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutomationRun {
  id: string;
  privateStatus: "pending" | "sending" | "sent" | "failed";
  publicStatus: "pending" | "sending" | "sent" | "failed";
}

export interface SocialTargetRef {
  id: string;
  postId: string;
}

const RULE_SELECT =
  "id, post_id, platform, keyword, keyword_normalized, public_reply, private_message, active, created_at, updated_at";

function mapRule(row: AutomationRuleRow): AutomationRule {
  return {
    id: row.id,
    postId: row.post_id,
    platform: row.platform as MetaPlatform,
    keyword: row.keyword,
    keywordNormalized: row.keyword_normalized,
    publicReply: row.public_reply,
    privateMessage: row.private_message,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Create one row per selected Meta platform. LinkedIn is intentionally excluded. */
export async function createAutomationRules(input: CreateAutomationRuleInput): Promise<void> {
  const keyword = input.keyword.trim();
  const publicReply = input.publicReply.trim();
  const privateMessage = input.privateMessage.trim();
  const rows = input.platforms.map((platform) => ({
    post_id: input.postId,
    platform,
    keyword,
    keyword_normalized: normalizeAutomationText(keyword),
    public_reply: publicReply,
    private_message: privateMessage,
    created_by: input.createdBy,
  }));
  if (rows.length === 0) return;

  const supabase = await createServerClient();
  const { error } = await supabase.from("social_automation_rules").insert(rows);
  if (error) throw new Error(`No se pudo guardar la automatización: ${error.message}`);
}

export async function listAutomationRules(): Promise<AutomationRule[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("social_automation_rules")
    .select(RULE_SELECT)
    .order("post_id", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`No se pudieron cargar las automatizaciones: ${error.message}`);
  return (data as unknown as AutomationRuleRow[]).map(mapRule);
}

/** Rules are read with the service-role client because this runs from Meta webhooks. */
export async function listApplicableAutomationRules(
  postId: string,
  platform: MetaPlatform,
): Promise<AutomationRule[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("social_automation_rules")
    .select(RULE_SELECT)
    .eq("platform", platform)
    .eq("active", true)
    .or(`post_id.eq.${postId},post_id.is.null`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`No se pudieron cargar las reglas: ${error.message}`);
  return (data as unknown as AutomationRuleRow[])
    .map(mapRule)
    .sort((a, b) => Number(b.postId === postId) - Number(a.postId === postId));
}

export async function getAutomationRulesForPost(postId: string): Promise<AutomationRule[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("social_automation_rules")
    .select(RULE_SELECT)
    .eq("post_id", postId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`No se pudieron cargar las automatizaciones: ${error.message}`);
  return (data as unknown as AutomationRuleRow[]).map(mapRule);
}

export async function setAutomationRuleActive(ruleId: string, active: boolean): Promise<void> {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("social_automation_rules")
    .update({ active })
    .eq("id", ruleId);
  if (error) throw new Error(`No se pudo actualizar la automatización: ${error.message}`);
}

export async function deleteAutomationRule(ruleId: string): Promise<void> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("social_automation_rules").delete().eq("id", ruleId);
  if (error) throw new Error(`No se pudo eliminar la automatización: ${error.message}`);
}

export async function findTargetByRemoteId(
  platform: MetaPlatform,
  remotePostId: string,
): Promise<SocialTargetRef | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("social_post_targets")
    .select("id, post_id")
    .eq("platform", platform)
    .eq("remote_id", remotePostId)
    .maybeSingle();
  if (error) throw new Error(`No se pudo localizar el post remoto: ${error.message}`);
  return data ? { id: data.id as string, postId: data.post_id as string } : null;
}

export async function getOrCreateAutomationRun(input: {
  ruleId: string;
  targetId: string;
  platform: MetaPlatform;
  remoteCommentId: string;
}): Promise<AutomationRun> {
  const supabase = createAdminClient();
  const { data: inserted } = await supabase
    .from("social_automation_runs")
    .insert({
      rule_id: input.ruleId,
      target_id: input.targetId,
      platform: input.platform,
      remote_comment_id: input.remoteCommentId,
    })
    .select("id, private_status, public_status")
    .maybeSingle();

  if (inserted) {
    return {
      id: inserted.id as string,
      privateStatus: inserted.private_status as AutomationRun["privateStatus"],
      publicStatus: inserted.public_status as AutomationRun["publicStatus"],
    };
  }

  const { data: existing, error } = await supabase
    .from("social_automation_runs")
    .select("id, private_status, public_status")
    .eq("rule_id", input.ruleId)
    .eq("platform", input.platform)
    .eq("remote_comment_id", input.remoteCommentId)
    .single();
  if (error || !existing)
    throw new Error(`No se pudo reservar la automatización: ${error?.message}`);
  return {
    id: existing.id as string,
    privateStatus: existing.private_status as AutomationRun["privateStatus"],
    publicStatus: existing.public_status as AutomationRun["publicStatus"],
  };
}

export async function updateAutomationRun(
  runId: string,
  patch: {
    privateStatus?: AutomationRun["privateStatus"];
    publicStatus?: AutomationRun["publicStatus"];
    error?: string | null;
  },
): Promise<void> {
  const supabase = createAdminClient();
  const update = {
    ...(patch.privateStatus ? { private_status: patch.privateStatus } : {}),
    ...(patch.publicStatus ? { public_status: patch.publicStatus } : {}),
    ...(patch.error !== undefined ? { error: patch.error } : {}),
  };
  const { error } = await supabase.from("social_automation_runs").update(update).eq("id", runId);
  if (error) throw new Error(`No se pudo actualizar la ejecución: ${error.message}`);
}

/** Claim one outbound step so concurrent webhook deliveries cannot duplicate it. */
export async function claimAutomationStep(
  runId: string,
  step: "private" | "public",
): Promise<boolean> {
  const supabase = createAdminClient();
  const column = step === "private" ? "private_status" : "public_status";
  const { data, error } = await supabase
    .from("social_automation_runs")
    .update({ [column]: "sending", error: null })
    .eq("id", runId)
    .in(column, ["pending", "failed"])
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`No se pudo reservar el envío: ${error.message}`);
  return Boolean(data);
}

export async function markCommentRepliedByRemote(
  targetId: string,
  remoteCommentId: string,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("social_comments")
    .update({ replied: true })
    .eq("target_id", targetId)
    .eq("remote_comment_id", remoteCommentId);
  if (error) throw new Error(`No se pudo marcar el comentario como respondido: ${error.message}`);
}
