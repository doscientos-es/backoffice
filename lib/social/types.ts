/**
 * Social Hub — persistence & view models.
 *
 * camelCase shapes the repository maps DB rows into, consumed by server
 * components, actions and the UI. Kept separate from lib/social/core (pure
 * domain) so the domain never leaks Supabase row shapes and vice-versa.
 */
import type {
  MediaItem,
  MediaKind,
  PostStatus,
  SocialPlatform,
  TargetStatus,
} from "@/lib/social/core";

/** A single (post, platform) target as stored, for lists and detail views. */
export interface TargetView {
  id: string;
  platform: SocialPlatform;
  status: TargetStatus;
  remoteId: string | null;
  remoteUrl: string | null;
  error: string | null;
  publishedAt: string | null;
}

/** Row of the posts list (dashboard/calendar), with its targets summarised. */
export interface PostListItem {
  id: string;
  caption: string;
  mediaKind: MediaKind;
  media: MediaItem[];
  status: PostStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  targets: TargetView[];
}

/** Insights snapshot as stored per target. */
export interface InsightsView {
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  videoViews: number;
  engagementRate: number;
  fetchedAt: string;
}

/** A target enriched with its latest insights, for the analytics view. */
export interface TargetWithInsights extends TargetView {
  insights: InsightsView | null;
}

/** Full detail of one composed post. */
export interface PostDetail extends PostListItem {
  targets: TargetWithInsights[];
}

/** A comment in the unified inbox, joined with its post caption. */
export interface CommentView {
  id: string;
  targetId: string;
  platform: SocialPlatform;
  remoteCommentId: string;
  authorName: string;
  text: string;
  likeCount: number;
  replied: boolean;
  publishedAt: string | null;
  postId: string;
  postCaption: string;
}

/** Input to create a composed post (already-uploaded media + target set). */
export interface CreatePostInput {
  caption: string;
  media: MediaItem[];
  platforms: SocialPlatform[];
  scheduledAt: string | null;
  createdBy: string | null;
}
