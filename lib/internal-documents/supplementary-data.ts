import 'server-only'
import { scopedLogger } from '@/lib/logger'

const log = scopedLogger('internal-documents.supplementary-data')

type QueryResult<T> = {
  data: T | null
  error: { code?: string | null; message?: string } | null
}

/**
 * Loads data that enriches a document page but must not block access to the
 * document itself, such as its audit trail or text-extraction status.
 */
export async function loadOptionalInternalDocData<T>(
  documentId: string,
  source: 'events' | 'extraction',
  query: PromiseLike<QueryResult<T>>,
): Promise<T | null> {
  try {
    const { data, error } = await query
    if (error) {
      log.warn(
        { documentId, source, errorCode: error.code ?? 'unknown', errorMessage: error.message },
        'could not load optional internal document data',
      )
      return null
    }
    return data
  } catch (error) {
    log.error(
      { documentId, source, err: error },
      'unexpected error loading optional internal document data',
    )
    return null
  }
}
