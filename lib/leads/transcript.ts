/** Pure helpers to keep meeting transcripts small and summarizable. */

export const MAX_STORED_TRANSCRIPT_CHARS = 100_000
/** Upper bound of text sent to the summarizer, so one huge meeting cannot cost unbounded calls. */
export const MAX_SUMMARIZED_TRANSCRIPT_CHARS = 240_000

const FILLER_ONLY =
  /^(?:[\p{L} .'-]{1,40}:\s*)?(?:m{2,}|eh+|ah+|uh+|um+|hm+)(?:[\s.,;:!?¡¿…-]+(?:m{2,}|eh+|ah+|uh+|um+|hm+))*[\s.,;:!?¡¿…-]*$/iu

/**
 * Removes noise that carries no information: blank runs, repeated lines and lines made only of
 * hesitation sounds ("mm", "eh"…), with or without a "Speaker:" prefix.
 * Short answers such as "sí", "no" and "vale" are kept: they can carry decisions.
 */
export function cleanTranscript(text: string): string {
  const out: string[] = []
  let previous = ''
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/[ \t]+/g, ' ').trim()
    if (!line) continue
    if (line === previous) continue
    if (FILLER_ONLY.test(line)) continue
    out.push(line)
    previous = line
  }
  return out.join('\n')
}

/** Cuts text to `max` characters at a line boundary when possible. */
export function truncateAtLine(text: string, max: number): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false }
  const cut = text.slice(0, max)
  const lastBreak = cut.lastIndexOf('\n')
  return { text: lastBreak > max * 0.8 ? cut.slice(0, lastBreak) : cut, truncated: true }
}

/** Lossless chunks, preferring line boundaries. Oversized lines are split, never discarded. */
export function chunkTranscript(text: string, size: number): string[] {
  if (!Number.isInteger(size) || size <= 0) throw new RangeError('Invalid chunk size')
  const chunks: string[] = []
  for (let offset = 0; offset < text.length;) {
    let end = Math.min(offset + size, text.length)
    if (end < text.length) {
      const lastBreak = text.lastIndexOf('\n', end - 1)
      if (lastBreak >= offset + size * 0.8) end = lastBreak + 1
    }
    chunks.push(text.slice(offset, end))
    offset = end
  }
  return chunks
}
