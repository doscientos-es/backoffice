/**
 * Minimal {{var}} interpolation. Unknown variables are left as-is so the
 * template editor can show them visibly to the operator.
 */
export function renderTemplate(
  template: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => {
    const value = vars[key];
    if (value == null) return match;
    return String(value);
  });
}

export function appendSignature(html: string, signature: string | null | undefined): string {
  if (!signature) return html;
  return `${html}\n<br/><br/>\n<div class="email-signature">${signature}</div>`;
}

export function extractVariables(template: string): string[] {
  const out = new Set<string>();
  for (const m of template.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) {
    out.add(m[1]!);
  }
  return [...out];
}
