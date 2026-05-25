import { serverEnv } from "@/lib/env";
import { Resend } from "resend";

let cached: Resend | null = null;

export function getResend(): Resend | null {
  const env = serverEnv();
  if (!env.RESEND_API_KEY) return null;
  if (cached) return cached;
  cached = new Resend(env.RESEND_API_KEY);
  return cached;
}

export type SendEmailInput = {
  fromName: string;
  fromAlias: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  tags?: Record<string, string>;
};

export async function sendEmail(
  input: SendEmailInput,
): Promise<{ id: string | null; mocked: boolean }> {
  const resend = getResend();
  const env = serverEnv();
  const from = `${input.fromName} <${input.fromAlias}@${env.RESEND_FROM_DOMAIN}>`;
  if (!resend) {
    return { id: null, mocked: true };
  }
  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    replyTo: input.replyTo,
    tags: input.tags
      ? Object.entries(input.tags).map(([name, value]) => ({ name, value }))
      : undefined,
  });
  if (error) throw new Error(error.message);
  return { id: data?.id ?? null, mocked: false };
}
