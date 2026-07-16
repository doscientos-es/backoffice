import type { SocialPlatform } from "@/lib/social/core";

export type MetaPlatform = Extract<SocialPlatform, "instagram" | "facebook">;

export interface AutomationRule {
  id: string;
  postId: string | null;
  platform: MetaPlatform;
  keyword: string;
  keywordNormalized: string;
  publicReply: string;
  privateMessage: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAutomationRuleInput {
  postId: string | null;
  platforms: MetaPlatform[];
  keyword: string;
  publicReply: string;
  privateMessage: string;
  createdBy: string | null;
}

export interface MetaCommentEvent {
  platform: MetaPlatform;
  sourceId: string;
  remotePostId: string;
  remoteCommentId: string;
  authorId: string | null;
  authorName: string;
  text: string;
  publishedAt: string | null;
}

export type AutomationRunStatus = "pending" | "sending" | "sent" | "failed";
