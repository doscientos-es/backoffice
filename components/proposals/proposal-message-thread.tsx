"use client";

import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type ProposalMessage = {
  id: string;
  author_type: "client" | "team";
  author_name: string;
  body: string;
  created_at: string;
};

type Result = { ok: true } | { ok: false; error: string };

export function ProposalMessageThread({
  messages,
  submit,
  disabled = false,
  sticky = true,
  embedded = false,
  showHeader = true,
  language = "es",
}: {
  messages: ProposalMessage[];
  submit: (body: string) => Promise<Result>;
  disabled?: boolean;
  sticky?: boolean;
  embedded?: boolean;
  showHeader?: boolean;
  language?: "es" | "ca" | "en";
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy =
    language === "ca"
      ? {
          title: "Consultes",
          intro: "Tens cap dubte o vols proposar un canvi? Escriu-nos aquí.",
          empty: "Encara no hi ha consultes.",
          aria: "Escriu la teva consulta",
          placeholder: "Escriu la teva pregunta…",
          sending: "Enviant…",
          submit: "Enviar consulta",
        }
      : language === "en"
        ? {
            title: "Questions",
            intro: "Have a question or want to suggest a change? Write to us here.",
            empty: "There are no questions yet.",
            aria: "Write your question",
            placeholder: "Write your question…",
            sending: "Sending…",
            submit: "Send question",
          }
        : {
            title: "Consultas",
            intro: "¿Tienes alguna duda o quieres proponer un cambio? Escríbenos aquí.",
            empty: "Aún no hay consultas.",
            aria: "Escribe tu consulta",
            placeholder: "Escribe tu pregunta…",
            sending: "Enviando…",
            submit: "Enviar consulta",
          };

  async function onSubmit(event: { preventDefault(): void }) {
    event.preventDefault();
    const text = body.trim();
    if (!text || pending) return;
    setPending(true);
    setError(null);
    const result = await submit(text);
    setPending(false);
    if (!result.ok) return setError(result.error);
    setBody("");
    router.refresh();
  }

  return (
    <aside
      className={
        embedded
          ? "p-4"
          : `rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800 ${sticky ? "lg:sticky lg:top-6" : ""}`
      }
    >
      {showHeader ? (
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 text-[#2A4227] dark:text-[#9CC196]" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{copy.title}</h2>
        </div>
      ) : null}
      <p
        className={`${showHeader ? "mt-2" : ""} text-xs leading-relaxed text-zinc-500 dark:text-zinc-400`}
      >
        {copy.intro}
      </p>
      <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">{copy.empty}</p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${message.author_type === "team" ? "bg-[#2A4227]/5 text-zinc-700 dark:bg-[#9CC196]/10 dark:text-zinc-200" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"}`}
            >
              <p className="mb-1 font-semibold">{message.author_name}</p>
              <p className="whitespace-pre-wrap">{message.body}</p>
            </div>
          ))
        )}
      </div>
      {!disabled ? (
        <form
          className="mt-4 space-y-2 border-t border-zinc-100 pt-4 dark:border-zinc-800"
          onSubmit={onSubmit}
        >
          <Textarea
            aria-label={copy.aria}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={copy.placeholder}
            maxLength={2000}
            rows={3}
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <Button type="submit" size="sm" className="w-full" disabled={pending || !body.trim()}>
            {pending ? copy.sending : copy.submit}
          </Button>
        </form>
      ) : null}
    </aside>
  );
}
