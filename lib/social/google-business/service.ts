import { upsertGoogleBusinessMetrics } from "@/lib/social/repo/google-business-performance";
import {
  getGoogleBusinessReview,
  updateGoogleBusinessReviewReply,
  upsertGoogleBusinessReviews,
} from "@/lib/social/repo/google-business-reviews";
import { googleBusinessProfileConfigured } from "./client";
import { fetchGoogleBusinessPerformance } from "./performance";
import {
  type GoogleBusinessMediaCategory,
  createGoogleBusinessMedia,
  deleteGoogleBusinessMedia,
} from "./profile";
import {
  deleteGoogleBusinessReviewReply,
  listGoogleBusinessReviews,
  replyToGoogleBusinessReview,
} from "./reviews";

function assertConfigured(): void {
  if (!googleBusinessProfileConfigured()) {
    throw new Error("Google Business Profile no está configurado.");
  }
}

export async function syncGoogleBusinessReviews(): Promise<{ synced: number }> {
  assertConfigured();
  const summary = await listGoogleBusinessReviews();
  return { synced: await upsertGoogleBusinessReviews(summary) };
}

export async function replyGoogleBusinessReview(input: {
  reviewId: string;
  comment: string;
}): Promise<void> {
  assertConfigured();
  const comment = input.comment.trim();
  if (!comment) throw new Error("La respuesta no puede estar vacía.");
  if (comment.length > 4096) throw new Error("La respuesta no puede superar 4.096 caracteres.");
  const review = await getGoogleBusinessReview(input.reviewId);
  if (!review) throw new Error("La reseña no existe en el backoffice.");
  await replyToGoogleBusinessReview(review.reviewName, comment);
  await updateGoogleBusinessReviewReply(input.reviewId, comment);
}

export async function removeGoogleBusinessReviewReply(reviewId: string): Promise<void> {
  assertConfigured();
  const review = await getGoogleBusinessReview(reviewId);
  if (!review) throw new Error("La reseña no existe en el backoffice.");
  await deleteGoogleBusinessReviewReply(review.reviewName);
  await updateGoogleBusinessReviewReply(reviewId, null);
}

export async function syncGoogleBusinessPerformance(days = 30): Promise<{ synced: number }> {
  assertConfigured();
  const metrics = await fetchGoogleBusinessPerformance(days);
  return { synced: await upsertGoogleBusinessMetrics(metrics) };
}

export async function addGoogleBusinessPhoto(input: {
  sourceUrl: string;
  category: GoogleBusinessMediaCategory;
  description?: string;
}): Promise<void> {
  assertConfigured();
  const url = new URL(input.sourceUrl);
  if (url.protocol !== "https:")
    throw new Error("Google requiere una URL HTTPS pública para la foto.");
  await createGoogleBusinessMedia(input);
}

export async function removeGoogleBusinessPhoto(mediaName: string): Promise<void> {
  assertConfigured();
  if (!mediaName.startsWith("accounts/")) throw new Error("Media de Google no válida.");
  await deleteGoogleBusinessMedia(mediaName);
}
