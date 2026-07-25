import { googleBusinessLocationName, googleBusinessRequest } from "./client";

export type GoogleReviewStarRating = "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";

export interface GoogleBusinessReview {
  name: string;
  reviewId?: string;
  reviewer?: {
    displayName?: string;
    profilePhotoUrl?: string;
    isAnonymous?: boolean;
  };
  starRating?: GoogleReviewStarRating | "STAR_RATING_UNSPECIFIED";
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: {
    comment?: string;
    updateTime?: string;
    reviewReplyState?: string;
    policyViolation?: string;
  };
}

interface ReviewsResponse {
  reviews?: GoogleBusinessReview[];
  averageRating?: number;
  totalReviewCount?: number;
  nextPageToken?: string;
}

export interface GoogleReviewSummary {
  reviews: GoogleBusinessReview[];
  averageRating: number | null;
  totalReviewCount: number | null;
}

export async function listGoogleBusinessReviews(): Promise<GoogleReviewSummary> {
  const reviews: GoogleBusinessReview[] = [];
  let pageToken: string | undefined;
  let averageRating: number | null = null;
  let totalReviewCount: number | null = null;

  do {
    const query = new URLSearchParams({ pageSize: "50", orderBy: "updateTime desc" });
    if (pageToken) query.set("pageToken", pageToken);
    const data = await googleBusinessRequest<ReviewsResponse>(
      `${googleBusinessLocationName()}/reviews?${query.toString()}`,
    );
    reviews.push(...(data.reviews ?? []));
    averageRating = data.averageRating ?? averageRating;
    totalReviewCount = data.totalReviewCount ?? totalReviewCount;
    pageToken = data.nextPageToken;
  } while (pageToken);

  return { reviews, averageRating, totalReviewCount };
}

export async function replyToGoogleBusinessReview(
  reviewName: string,
  comment: string,
): Promise<void> {
  await googleBusinessRequest(`${reviewName}/reply`, {
    method: "PUT",
    body: JSON.stringify({ comment }),
  });
}

export async function deleteGoogleBusinessReviewReply(reviewName: string): Promise<void> {
  await googleBusinessRequest(`${reviewName}/reply`, { method: "DELETE" });
}
