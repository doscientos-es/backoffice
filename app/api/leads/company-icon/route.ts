import { requireUser } from '@/lib/auth'
import { isCorporateDomain } from '@/lib/leads/company-domain'
import { can } from '@/lib/permissions'

export async function GET(request: Request) {
  const user = await requireUser()
  if (!can(user.role, 'leads.read')) return new Response(null, { status: 403 })

  const domain = new URL(request.url).searchParams.get('domain') ?? ''
  if (!isCorporateDomain(domain)) return new Response(null, { status: 400 })

  try {
    const url = new URL('https://www.google.com/s2/favicons')
    url.searchParams.set('domain', domain)
    url.searchParams.set('sz', '128')
    const response = await fetch(url, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/png')) {
      return new Response(null, { status: 404 })
    }
    const image = await response.arrayBuffer()
    if (image.byteLength > 1_000_000) return new Response(null, { status: 502 })
    return new Response(new Uint8Array(image), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return new Response(null, { status: 502 })
  }
}
