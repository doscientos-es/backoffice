import { scopedLogger } from '@/lib/logger'
import {
  googleBusinessAccountId,
  googleBusinessLocationId,
} from '@/lib/social/google-business/client'
import type {
  GoogleBusinessReview,
  GoogleReviewSummary,
} from '@/lib/social/google-business/reviews'
import type { GoogleReviewView } from '@/lib/social/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'

const log = scopedLogger('social-repo-google-reviews')

interface ReviewRow {
  id: string
  review_name: string
  reviewer_name: string
  reviewer_photo_url: string | null
  is_anonymous: boolean
  star_rating: string
  comment: string
  create_time: string | null
  update_time: string | null
  reply_comment: string | null
  reply_update_time: string | null
  reply_state: string | null
  policy_violation: string | null
}

function mapReview(row: ReviewRow): GoogleReviewView {
  return {
    id: row.id,
    reviewName: row.review_name,
    reviewerName: row.reviewer_name,
    reviewerPhotoUrl: row.reviewer_photo_url,
    isAnonymous: row.is_anonymous,
    starRating: row.star_rating,
    comment: row.comment,
    createdAt: row.create_time,
    updatedAt: row.update_time,
    replyComment: row.reply_comment,
    replyUpdatedAt: row.reply_update_time,
    replyState: row.reply_state,
    policyViolation: row.policy_violation,
    replied: Boolean(row.reply_comment),
  }
}

function reviewRow(review: GoogleBusinessReview) {
  return {
    account_id: googleBusinessAccountId(),
    location_id: googleBusinessLocationId(),
    review_name: review.name,
    reviewer_name: review.reviewer?.displayName ?? 'Usuario de Google',
    reviewer_photo_url: review.reviewer?.profilePhotoUrl ?? null,
    is_anonymous: review.reviewer?.isAnonymous ?? false,
    star_rating: review.starRating ?? 'STAR_RATING_UNSPECIFIED',
    comment: review.comment ?? '',
    create_time: review.createTime ?? null,
    update_time: review.updateTime ?? null,
    reply_comment: review.reviewReply?.comment ?? null,
    reply_update_time: review.reviewReply?.updateTime ?? null,
    reply_state: review.reviewReply?.reviewReplyState ?? null,
    policy_violation: review.reviewReply?.policyViolation ?? null,
    synced_at: new Date().toISOString(),
  }
}

export async function upsertGoogleBusinessReviews(summary: GoogleReviewSummary): Promise<number> {
  if (summary.reviews.length === 0) return 0
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('google_business_reviews')
    .upsert(summary.reviews.map(reviewRow), { onConflict: 'review_name' })
  if (error) {
    log.error({ err: error.message }, 'upsert_google_reviews_failed')
    throw new Error(`No se pudieron guardar las reseñas de Google: ${error.message}`)
  }
  return summary.reviews.length
}

export async function listGoogleBusinessReviewViews(options?: {
  rating?: string
  replied?: 'all' | 'replied' | 'pending'
}): Promise<GoogleReviewView[]> {
  const supabase = await createServerClient()
  let query = supabase
    .from('google_business_reviews')
    .select(
      'id, review_name, reviewer_name, reviewer_photo_url, is_anonymous, star_rating, comment, create_time, update_time, reply_comment, reply_update_time, reply_state, policy_violation',
    )
    .order('create_time', { ascending: false })
  if (options?.rating && options.rating !== 'all') query = query.eq('star_rating', options.rating)
  if (options?.replied === 'replied') query = query.not('reply_comment', 'is', null)
  if (options?.replied === 'pending') query = query.is('reply_comment', null)
  const { data, error } = await query
  if (error) {
    log.error({ err: error.message }, 'list_google_reviews_failed')
    return []
  }
  return (data as unknown as ReviewRow[]).map(mapReview)
}

export interface GoogleBusinessReviewRef {
  id: string
  reviewName: string
}

export async function getGoogleBusinessReview(id: string): Promise<GoogleBusinessReviewRef | null> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('google_business_reviews')
    .select('id, review_name')
    .eq('id', id)
    .maybeSingle()
  if (error) log.error({ id, err: error.message }, 'get_google_review_failed')
  if (!data) return null
  return { id: data.id as string, reviewName: data.review_name as string }
}

export async function updateGoogleBusinessReviewReply(
  id: string,
  replyComment: string | null,
): Promise<void> {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('google_business_reviews')
    .update({
      reply_comment: replyComment,
      reply_update_time: new Date().toISOString(),
      reply_state: null,
      policy_violation: null,
    })
    .eq('id', id)
  if (error) log.error({ id, err: error.message }, 'update_google_review_reply_failed')
}
