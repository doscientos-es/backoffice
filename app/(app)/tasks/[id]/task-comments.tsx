"use client";

import { addComment, deleteComment } from "@/app/(app)/tasks/comment-actions";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from "react";

export type CommentItem = {
  id: string;
  body: string;
  created_at: string;
  author: { id: string; name: string } | null;
};

type Props = {
  taskId: string;
  memberId: string;
  memberRole: string;
  initialComments: CommentItem[];
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Highlight @mentions in rendered body
function renderBody(body: string) {
  return body.split(/(@[\w.-]+)/g).map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="font-medium text-primary">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

export function TaskComments({ taskId, memberId, memberRole, initialComments }: Props) {
  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [optimistic, addOptimistic] = useOptimistic(comments, (state, c: CommentItem) => [
    ...state,
    c,
  ]);
  const [body, setBody] = useState("");
  const [, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchComments = useCallback(async () => {
    const supabase = getBrowserClient();
    const { data } = await supabase
      .from("task_comments")
      .select("id, body, created_at, author:author_id(id, name)")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });
    if (data) setComments(data as unknown as CommentItem[]);
  }, [taskId]);

  useEffect(() => {
    const supabase = getBrowserClient();
    const ch = supabase
      .channel(`comments-${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_comments", filter: `task_id=eq.${taskId}` },
        () => fetchComments(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [taskId, fetchComments]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    const optimisticComment: CommentItem = {
      id: `opt-${Date.now()}`,
      body: trimmed,
      created_at: new Date().toISOString(),
      author: { id: memberId, name: "Tú" },
    };
    setBody("");
    startTransition(async () => {
      addOptimistic(optimisticComment);
      await addComment({ taskId, body: trimmed });
      await fetchComments();
    });
  }

  const canDelete = (authorId: string) =>
    authorId === memberId || memberRole === "owner" || memberRole === "admin";

  return (
    <div className="flex flex-col gap-3">
      {optimistic.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Sin comentarios todavía.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {optimistic.map((c) => (
            <li key={c.id} className="flex flex-col gap-0.5 rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">{c.author?.name ?? "—"}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{fmtDate(c.created_at)}</span>
                  {c.author?.id && canDelete(c.author.id) && !c.id.startsWith("opt-") && (
                    <button
                      type="button"
                      title="Eliminar"
                      onClick={() =>
                        startTransition(async () => {
                          await deleteComment({ commentId: c.id, taskId });
                          await fetchComments();
                        })
                      }
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{renderBody(c.body)}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escribe un comentario… usa @nombre para mencionar"
          rows={3}
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(e);
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">⌘↵ para enviar</span>
          <button
            type="submit"
            disabled={!body.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            Comentar
          </button>
        </div>
      </form>
    </div>
  );
}
