/**
 * Single source of truth for the HTML email signature used across the app.
 *
 * Imported by:
 *   - `app/(app)/settings/actions.ts`       — persists signature_html to DB on profile save
 *   - `app/(app)/settings/profile-form.tsx` — live client-side preview while editing profile
 *   - `app/(app)/settings/email-templates/page.tsx` — passes real signature to template manager
 *
 * @param opts   User data to embed.
 * @param appUrl Absolute base URL used to resolve the logo image. Pass an empty
 *               string (default) in browser contexts where relative paths work.
 *               On the server, pass `process.env.NEXT_PUBLIC_APP_URL`.
 */
export function buildSignatureHtml(
  opts: {
    name: string;
    jobTitle?: string;
    contactEmail?: string;
    phone?: string;
  },
  appUrl = "",
): string {
  const base = appUrl.replace(/\/$/, "");
  const logoSrc = `${base}/brand/logo.svg`;

  const lines: string[] = [];
  lines.push(`<strong style="color:#111">${opts.name}</strong>`);
  if (opts.jobTitle) lines.push(`<span style="color:#555">${opts.jobTitle}</span>`);
  lines.push("");
  lines.push('<strong style="color:#2A4227">doscientos.es</strong>');
  lines.push("");
  if (opts.contactEmail)
    lines.push(
      `📩 <a href="mailto:${opts.contactEmail}" style="color:inherit">${opts.contactEmail}</a>`,
    );
  lines.push('🌐 <a href="https://doscientos.es" style="color:inherit">https://doscientos.es</a>');
  if (opts.phone) lines.push(`📱 ${opts.phone}`);

  const text = lines.join("<br/>");
  return (
    `<table cellpadding="0" cellspacing="0" border="0" ` +
    `style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#333;margin:0">` +
    `<tr>` +
    `<td style="padding-right:14px;vertical-align:middle;border-right:2px solid #2A4227">` +
    `<img src="${logoSrc}" width="36" height="36" alt="doscientos" style="display:block"/>` +
    `</td>` +
    `<td style="padding-left:14px;vertical-align:top">${text}</td>` +
    `</tr></table>`
  );
}
