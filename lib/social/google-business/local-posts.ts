import { googleBusinessLocationName, googleBusinessRequest } from './client'

const LOCAL_POST_METRICS = ['LOCAL_POST_VIEWS_SEARCH', 'LOCAL_POST_ACTIONS_CALL_TO_ACTION'] as const

interface MetricValue {
  metric?: string
  totalValue?: { value?: string }
  dimensionalValues?: Array<{ value?: string }>
}

interface LocalPostInsightsResponse {
  localPostMetrics?: Array<{
    localPostName?: string
    metricValues?: MetricValue[]
  }>
  timeZone?: string
}

export interface GoogleLocalPostInsights {
  views: number
  actions: number
  timeZone: string | null
  raw: unknown
}

export interface GoogleLocalPost {
  name: string
  languageCode?: string
  summary?: string
  topicType?: string
  state?: string
  searchUrl?: string
  createTime?: string
  updateTime?: string
}

interface LocalPostsResponse {
  localPosts?: GoogleLocalPost[]
  nextPageToken?: string
}

function localPostName(remoteId: string): string {
  return remoteId.startsWith('accounts/')
    ? remoteId
    : `${googleBusinessLocationName()}/localPosts/${remoteId}`
}

function metricTotal(metric: MetricValue | undefined): number {
  const value = metric?.totalValue?.value ?? metric?.dimensionalValues?.[0]?.value
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function dateRange() {
  const end = new Date()
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 30)
  return { startTime: start.toISOString(), endTime: end.toISOString() }
}

export async function getGoogleLocalPostInsights(
  remoteId: string,
): Promise<GoogleLocalPostInsights> {
  const data = await googleBusinessRequest<LocalPostInsightsResponse>(
    `${googleBusinessLocationName()}/localPosts:reportInsights`,
    {
      method: 'POST',
      body: JSON.stringify({
        localPostNames: [localPostName(remoteId)],
        basicRequest: {
          metricRequests: LOCAL_POST_METRICS.map((metric) => ({
            metric,
            options: ['AGGREGATED_TOTAL'],
          })),
          timeRange: dateRange(),
        },
      }),
    },
  )
  const metrics = data.localPostMetrics?.[0]?.metricValues ?? []
  const byMetric = new Map(metrics.map((metric) => [metric.metric, metric]))
  return {
    views: metricTotal(byMetric.get('LOCAL_POST_VIEWS_SEARCH')),
    actions: metricTotal(byMetric.get('LOCAL_POST_ACTIONS_CALL_TO_ACTION')),
    timeZone: data.timeZone ?? null,
    raw: data,
  }
}

export async function listGoogleLocalPosts(): Promise<GoogleLocalPost[]> {
  const posts: GoogleLocalPost[] = []
  let pageToken: string | undefined
  do {
    const query = new URLSearchParams({ pageSize: '100' })
    if (pageToken) query.set('pageToken', pageToken)
    const data = await googleBusinessRequest<LocalPostsResponse>(
      `${googleBusinessLocationName()}/localPosts?${query.toString()}`,
    )
    posts.push(...(data.localPosts ?? []))
    pageToken = data.nextPageToken
  } while (pageToken)
  return posts
}

export async function updateGoogleLocalPost(
  remoteId: string,
  post: Pick<GoogleLocalPost, 'summary' | 'languageCode' | 'topicType'>,
): Promise<GoogleLocalPost> {
  const query = new URLSearchParams({ updateMask: 'summary,languageCode,topicType' })
  return googleBusinessRequest<GoogleLocalPost>(`${localPostName(remoteId)}?${query.toString()}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: localPostName(remoteId), ...post }),
  })
}
