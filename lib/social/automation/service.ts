import { scopedLogger } from "@/lib/logger";
import { canReply } from "@/lib/social/core";
import { sendPrivateReply } from "@/lib/social/meta/messaging";
import { socialRegistry } from "@/lib/social/registry";
import * as repo from "@/lib/social/repo";
import { matchesAutomationKeyword, selectMatchingRule } from "./matcher";
import type { MetaCommentEvent } from "./types";

const log = scopedLogger("social-automation");

export type AutomationProcessResult = "ignored" | "no_match" | "processed";

/** Process one Meta comment with post-specific rules taking precedence globally. */
export async function processMetaCommentEvent(
  event: MetaCommentEvent,
): Promise<AutomationProcessResult> {
  // Meta can send our own replies back through the feed webhook; never loop on them.
  if (event.authorId && event.authorId === event.sourceId) return "ignored";

  const target = await repo.findTargetByRemoteId(event.platform, event.remotePostId);
  if (!target) return "ignored";

  await repo.upsertComments(target.id, event.platform, [
    {
      remoteId: event.remoteCommentId,
      authorName: event.authorName,
      authorId: event.authorId,
      text: event.text,
      likeCount: 0,
      publishedAt: event.publishedAt,
    },
  ]);

  const rules = await repo.listApplicableAutomationRules(target.postId, event.platform);
  const rule = selectMatchingRule(rules, target.postId, event.text);
  if (!rule || !matchesAutomationKeyword(event.text, rule.keyword)) return "no_match";

  const run = await repo.getOrCreateAutomationRun({
    ruleId: rule.id,
    targetId: target.id,
    platform: event.platform,
    remoteCommentId: event.remoteCommentId,
  });
  if (run.privateStatus === "sent" && run.publicStatus === "sent") return "processed";

  if (run.privateStatus !== "sent" && (await repo.claimAutomationStep(run.id, "private"))) {
    try {
      await sendPrivateReply(event.platform, event.remoteCommentId, rule.privateMessage);
      await repo.updateAutomationRun(run.id, { privateStatus: "sent", error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await repo.updateAutomationRun(run.id, { privateStatus: "failed", error: message });
      log.warn(
        { platform: event.platform, remoteCommentId: event.remoteCommentId },
        "private_reply_failed",
      );
      throw error;
    }
  } else if (run.privateStatus !== "sent") {
    // Another delivery is already sending the private reply. Do not publish the
    // public confirmation until that request has completed successfully.
    return "processed";
  }

  if (run.publicStatus !== "sent" && (await repo.claimAutomationStep(run.id, "public"))) {
    try {
      const registry = socialRegistry();
      if (!registry.isAvailable(event.platform)) {
        throw new Error(`La red ${event.platform} no está configurada para responder comentarios.`);
      }
      const publisher = registry.get(event.platform);
      if (!canReply(publisher)) throw new Error(`La red ${event.platform} no permite respuestas.`);
      await publisher.replyToComment(event.remoteCommentId, rule.publicReply);
      await repo.updateAutomationRun(run.id, { publicStatus: "sent", error: null });
      await repo.markCommentRepliedByRemote(target.id, event.remoteCommentId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await repo.updateAutomationRun(run.id, { publicStatus: "failed", error: message });
      log.warn(
        { platform: event.platform, remoteCommentId: event.remoteCommentId },
        "public_reply_failed",
      );
      throw error;
    }
  }

  return "processed";
}
