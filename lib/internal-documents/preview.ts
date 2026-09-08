import 'server-only'

import { scopedLogger } from '@/lib/logger'
import { getStorage } from '@/lib/storage'

const log = scopedLogger('internal-documents.preview')
const PREVIEW_TTL = 600

/**
 * Produces a short-lived preview URL without allowing Storage failures to
 * prevent the document detail page from rendering.
 */
export async function getInternalDocPreviewUrl(
  documentId: string,
  storagePath: string | null,
): Promise<string | null> {
  if (!storagePath) return null

  try {
    const { url, error } = await getStorage().createSignedUrl(
      'internal-docs',
      storagePath,
      PREVIEW_TTL,
    )
    if (url) return url

    log.warn(
      { documentId, reason: error ? 'provider_error' : 'missing_url' },
      'could not generate internal document preview URL',
    )
  } catch (error) {
    log.error(
      { documentId, errorType: error instanceof Error ? error.name : typeof error },
      'unexpected error generating internal document preview URL',
    )
  }

  return null
}