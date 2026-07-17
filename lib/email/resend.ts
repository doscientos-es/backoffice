import { isDemoMode } from "@/lib/demo";
import { serverEnv } from "@/lib/env";
import { Resend } from "resend";

let cached: Resend | null = null;

export function getResend(): Resend | null {
  if (isDemoMode()) return null;

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
  const env = serverEnv();
  if (isDemoMode()) return { id: null, mocked: true };

  const resend = getResend();
  const safeName = input.fromName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const address = input.fromAlias.includes("@")
    ? input.fromAlias
    : `${input.fromAlias}@${env.RESEND_FROM_DOMAIN}`;
  const from = `"${safeName}" <${address}>`;
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
