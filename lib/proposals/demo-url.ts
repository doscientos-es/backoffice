/** Only web URLs without embedded credentials can be published as a demo. */
export function isProposalDemoUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      /^https?:\/\//i.test(value) &&
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      !url.username &&
      !url.password &&
      !/\s/.test(value)
    )
  } catch {
    return false
  }
}
