const VIEWABLE_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'text/plain'])

export function canPreviewAttachment(mimeType: string | null): boolean {
  return VIEWABLE_MIME_TYPES.has(mimeType ?? '')
}
