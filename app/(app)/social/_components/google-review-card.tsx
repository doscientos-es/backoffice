"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Textarea } from "@/components/ui/textarea";
import type { GoogleReviewView } from "@/lib/social/types";
import { cn, formatDateTime } from "@/lib/utils";
import { Reply, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { removeGoogleBusinessReviewReply, replyToGoogleBusinessReview } from "../actions";

const RATING_LABELS: Record<string, string> = {
  ONE: "1 estrella",
  TWO: "2 estrellas",
  THREE: "3 estrellas",
  FOUR: "4 estrellas",
  FIVE: "5 estrellas",
};

function ratingValue(rating: string): number {
  return { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }[rating] ?? 0;
}

export function GoogleReviewCard({ review }: { review: GoogleReviewView }) {
  const router = useRouter();
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState(review.replyComment ?? "");
  const { state, setPending, setSuccess, setError, pending } = useFormFeedback();
  const rating = ratingValue(review.starRating);

  async function handleReply() {
    if (!replyText.trim()) return;
    setPending();
    const result = await replyToGoogleBusinessReview({
      reviewId: review.id,
      message: replyText,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSuccess("Respuesta enviada");
    setShowReply(false);
    router.refresh();
  }

  async function handleDeleteReply() {
    if (!window.confirm("¿Eliminar la respuesta pública de Google?")) return;
    setPending();
    const result = await removeGoogleBusinessReviewReply({ reviewId: review.id });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSuccess("Respuesta eliminada");
    router.refresh();
  }

  return (
    <Card className={cn("overflow-hidden", review.replied && "bg-muted/20")}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-4 pb-2">
        <div className="flex min-w-0 items-center gap-3">
          {review.reviewerPhotoUrl ? (
            // Google-hosted avatars can be unavailable in environments without remote image config.
            <img
              src={review.reviewerPhotoUrl}
              alt=""
              className="size-9 rounded-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
              {review.reviewerName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{review.reviewerName}</p>
            <time
              className="text-[10px] text-muted-foreground"
              title={review.updatedAt ? formatDateTime(review.updatedAt) : undefined}
            >
              {review.updatedAt ? formatDateTime(review.updatedAt) : "Fecha no disponible"}
            </time>
          </div>
        </div>
        <div
          className="flex shrink-0 items-center gap-1"
          aria-label={RATING_LABELS[review.starRating]}
        >
          {Array.from({ length: 5 }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed 5-star rating, order never changes
            <Star
              key={`star-${index}`}
              className={cn(
                "size-3.5",
                index < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30",
              )}
            />
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-1">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {review.comment || "Sin comentario escrito."}
        </p>
        {review.replyComment ? (
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Reply className="size-3.5" />
              Respuesta de la empresa
            </div>
            <p className="whitespace-pre-wrap text-sm">{review.replyComment}</p>
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-col items-stretch border-t border-border/50 bg-muted/5 p-2 px-4">
        <div className="flex items-center justify-between gap-3 py-1">
          <FormFeedback state={state} />
          <div className="flex gap-1">
            {review.replied ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-destructive hover:text-destructive"
                onClick={handleDeleteReply}
                disabled={pending}
              >
                <Trash2 className="size-3.5" />
                Eliminar respuesta
              </Button>
            ) : null}
            {!showReply ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setShowReply(true)}
              >
                <Reply className="size-3.5" />
                {review.replied ? "Editar respuesta" : "Responder"}
              </Button>
            ) : null}
          </div>
        </div>
        {showReply ? (
          <div className="flex flex-col gap-2 pt-2 pb-1">
            <Textarea
              value={replyText}
              onChange={(event) => setReplyText(event.target.value)}
              placeholder="Escribe una respuesta pública…"
              maxLength={4096}
              className="min-h-20 resize-none text-sm"
              disabled={pending}
              autoFocus
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] text-muted-foreground">{replyText.length}/4096</span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReply(false)}
                  disabled={pending}
                >
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleReply} disabled={pending || !replyText.trim()}>
                  {pending ? "Enviando…" : "Enviar"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </CardFooter>
    </Card>
  );
}
