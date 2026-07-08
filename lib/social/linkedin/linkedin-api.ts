/**
 * Social Hub — LinkedIn REST operations (low level).
 *
 * Pure API calls against the Community Management API (versioned /rest/posts,
 * /rest/images, /rest/videos). The Publisher composes these; keeping them here
 * isolates the initialize-upload → PUT-bytes → reference-URN protocol from the
 * Publisher's capability/orchestration logic.
 */
import type { MediaItem, PlatformComment } from "@/lib/social/core";
import { PublishError } from "@/lib/social/core";
import { authorUrn, restGet, restPostForId, restPostJson, uploadBinary } from "./client";

/** Standard MAIN_FEED distribution block shared by every post shape. */
function distribution() {
  return { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] };
}

function basePost(commentary: string): Record<string, unknown> {
  return {
    author: authorUrn(),
    commentary,
    visibility: "PUBLIC",
    distribution: distribution(),
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
}

/** Publish a text-only post, returning its share URN. */
export function createTextPost(commentary: string): Promise<string> {
  return restPostForId("posts", basePost(commentary));
}

interface InitUploadResponse {
  value: { uploadUrl: string; image?: string; video?: string };
}

/** Register + upload one image, returning its `urn:li:image:...`. */
export async function uploadImage(item: MediaItem): Promise<string> {
  const init = await restPostJson<InitUploadResponse>(
    "images",
    { initializeUploadRequest: { owner: authorUrn() } },
    { action: "initializeUpload" },
  );
  const urn = init.value.image;
  if (!urn) throw new PublishError("linkedin", "LinkedIn no devolvió el URN de la imagen.");
  await uploadBinary(init.value.uploadUrl, item.publicUrl);
  return urn;
}

/** Register + upload one video (single-part), returning its `urn:li:video:...`. */
export async function uploadVideo(item: MediaItem): Promise<string> {
  const init = await restPostJson<InitUploadResponse>(
    "videos",
    { initializeUploadRequest: { owner: authorUrn(), fileSizeBytes: 0, uploadCaptions: false } },
    { action: "initializeUpload" },
  );
  const urn = init.value.video;
  if (!urn) throw new PublishError("linkedin", "LinkedIn no devolvió el URN del vídeo.");
  await uploadBinary(init.value.uploadUrl, item.publicUrl);
  return urn;
}

/** Publish a post carrying a single image or video by its media URN. */
export function createMediaPost(commentary: string, mediaUrn: string, altText: string): Promise<string> {
  return restPostForId("posts", {
    ...basePost(commentary),
    content: { media: { id: mediaUrn, altText } },
  });
}

/** Publish a multi-image post (carousel) from N image URNs. */
export function createMultiImagePost(commentary: string, imageUrns: string[]): Promise<string> {
  return restPostForId("posts", {
    ...basePost(commentary),
    content: { multiImage: { images: imageUrns.map((id) => ({ id, altText: "" })) } },
  });
}

/** Best-effort permalink for a published share URN. */
export function permalinkFor(shareUrn: string): string {
  const id = shareUrn.split(":").pop() ?? shareUrn;
  return `https://www.linkedin.com/feed/update/${encodeURIComponent(shareUrn.startsWith("urn:") ? shareUrn : `urn:li:share:${id}`)}`;
}

interface LiComment {
  id?: string;
  message?: { text?: string };
  actor?: string;
  created?: { time?: number };
}

/** Fetch comments on a published share, normalised. */
export async function getPostComments(shareUrn: string): Promise<PlatformComment[]> {
  const encoded = encodeURIComponent(shareUrn);
  const res = await restGet<{ elements?: LiComment[] }>(`socialActions/${encoded}/comments`);
  return (res.elements ?? []).map((c) => ({
    remoteId: c.id ?? "",
    authorName: c.actor ?? "",
    authorId: c.actor ?? null,
    text: c.message?.text ?? "",
    likeCount: 0,
    publishedAt: c.created?.time ? new Date(c.created.time).toISOString() : null,
  }));
}

/** Reply to a comment (a comment on the same share, parented to the target). */
export async function replyToComment(shareUrn: string, message: string): Promise<void> {
  const encoded = encodeURIComponent(shareUrn);
  await restPostJson(`socialActions/${encoded}/comments`, {
    actor: authorUrn(),
    message: { text: message },
  });
}
