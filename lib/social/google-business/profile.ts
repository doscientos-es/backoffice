import {
  googleBusinessInformationRequest,
  googleBusinessLocationName,
  googleBusinessRequest,
} from './client'

export interface GoogleBusinessLocationProfile {
  name?: string
  title?: string
  phoneNumbers?: { primaryPhone?: string }
  websiteUri?: string
  storefrontAddress?: {
    addressLines?: string[]
    locality?: string
    postalCode?: string
    administrativeArea?: string
  }
  regularHours?: {
    periods?: Array<{
      openDay?: string
      openTime?: { hours?: number; minutes?: number }
      closeDay?: string
      closeTime?: { hours?: number; minutes?: number }
    }>
  }
  categories?: { primaryCategory?: { displayName?: string } }
}

export interface GoogleBusinessMediaItem {
  name: string
  mediaFormat?: 'PHOTO' | 'VIDEO' | 'MEDIA_FORMAT_UNSPECIFIED'
  sourceUrl?: string
  googleUrl?: string
  description?: string
  locationAssociation?: { category?: string }
}

interface MediaResponse {
  mediaItems?: GoogleBusinessMediaItem[]
  nextPageToken?: string
  totalMediaItemCount?: number
}

export type GoogleBusinessMediaCategory =
  | 'COVER'
  | 'PROFILE'
  | 'LOGO'
  | 'EXTERIOR'
  | 'INTERIOR'
  | 'PRODUCT'
  | 'AT_WORK'
  | 'FOOD_AND_DRINK'
  | 'MENU'
  | 'COMMON_AREA'
  | 'ROOMS'
  | 'TEAMS'
  | 'ADDITIONAL'

export async function getGoogleBusinessLocationProfile(): Promise<GoogleBusinessLocationProfile> {
  const query = new URLSearchParams({
    readMask: 'name,title,phoneNumbers,websiteUri,storefrontAddress,regularHours,categories',
  })
  return googleBusinessInformationRequest<GoogleBusinessLocationProfile>(
    `${googleBusinessLocationName()}?${query.toString()}`,
  )
}

export async function listGoogleBusinessMedia(): Promise<GoogleBusinessMediaItem[]> {
  const items: GoogleBusinessMediaItem[] = []
  let pageToken: string | undefined
  do {
    const query = new URLSearchParams({ pageSize: '100' })
    if (pageToken) query.set('pageToken', pageToken)
    const response = await googleBusinessRequest<MediaResponse>(
      `${googleBusinessLocationName()}/media?${query.toString()}`,
    )
    items.push(...(response.mediaItems ?? []))
    pageToken = response.nextPageToken
  } while (pageToken)
  return items
}

export async function createGoogleBusinessMedia(input: {
  sourceUrl: string
  category: GoogleBusinessMediaCategory
  description?: string
}): Promise<GoogleBusinessMediaItem> {
  return googleBusinessRequest<GoogleBusinessMediaItem>(`${googleBusinessLocationName()}/media`, {
    method: 'POST',
    body: JSON.stringify({
      mediaFormat: 'PHOTO',
      sourceUrl: input.sourceUrl,
      description: input.description?.trim() || undefined,
      locationAssociation: { category: input.category },
    }),
  })
}

export async function deleteGoogleBusinessMedia(mediaName: string): Promise<void> {
  await googleBusinessRequest(mediaName, { method: 'DELETE' })
}
