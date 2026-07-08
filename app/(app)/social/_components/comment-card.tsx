"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Textarea } from "@/components/ui/textarea";
import type { CommentView } from "@/lib/social/types";
import { cn } from "@/lib/utils";
import { formatDateTime, relativeTime } from "@/lib/utils";
import { Heart, MessageSquare, Reply } from "lucide-react";
import { useState } from "react";
import { replyToComment } from "../actions";
import { PlatformChip } from "./platform";

/**
 * Unified comment inbox item. Shows the original comment, platform info,
 * the post it belongs to, and an expandable reply form.
 */
export function CommentCard({ comment }: { comment: CommentView }) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const { state, setPending, setSuccess, setError, pending } = useFormFeedback();

  async function handleReply() {
    if (!replyText.trim()) return;
    setPending();
    const res = await replyToComment({
      commentId: comment.id,
      message: replyText,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSuccess("Respuesta enviada");
    setReplyText("");
    setTimeout(() => setShowReply(false), 2000);
  }

  return (
    <Card className={cn("overflow-hidden", comment.replied && "bg-muted/30 opacity-80")}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 p-4 pb-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{comment.authorName}</span>
            <PlatformChip platform={comment.platform} />
          </div>
          <time
            className="text-[10px] text-muted-foreground uppercase"
            title={formatDateTime(comment.publishedAt)}
          >
            {relativeTime(comment.publishedAt)}
          </time>
        </div>
        {comment.replied && (
          <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success ring-1 ring-success/20">
            Respondido
          </span>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{comment.text}</p>
        
        {/* Post Context */}
        <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/20 px-2 py-1.5 text-[11px] text-muted-foreground">
          <MessageSquare className="size-3 shrink-0" />
          <span className="font-medium">En post:</span>
          <span className="truncate italic">"{comment.postCaption || "(Sin texto)"}"</span>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-stretch border-t border-border/50 bg-muted/5 p-2 px-4">
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="flex items-center gap-1 text-xs">
              <Heart className="size-3" />
              {comment.likeCount}
            </span>
          </div>
          {!comment.replied && !showReply && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => setShowReply(true)}
            >
              <Reply className="size-3.5" />
              Responder
            </Button>
          )}
        </div>

        {showReply && (
          <div className="flex flex-col gap-2 pt-2 pb-1 animate-in slide-in-from-top-1 duration-200">
            <Textarea
              placeholder="Escribe tu respuesta pública..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="min-h-[80px] text-sm resize-none"
              disabled={pending}
              autoFocus
            />
            <div className="flex items-center justify-between gap-4">
              <FormFeedback state={state} />
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReply(false)}
                  disabled={pending}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleReply}
                  disabled={pending || !replyText.trim()}
                >
                  {pending ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
