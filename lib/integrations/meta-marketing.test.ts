import { describe, expect, it } from 'vitest'

import { extractMetaCreativeDetails, extractMetaTrafficMetrics } from './meta-marketing'
import { getMarketingSyncErrorMessage } from '../marketing-sync'

describe('Meta marketing funnel metrics', () => {
  it('keeps the message from structured Supabase errors', () => {
    expect(
      getMarketingSyncErrorMessage({
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      }),
    ).toBe('duplicate key value violates unique constraint')
  })

  it("extracts link and landing metrics from Meta's mixed insight fields", () => {
    expect(
      extractMetaTrafficMetrics({
        date_start: '2026-08-09',
        date_stop: '2026-08-09',
        impressions: '1',
        reach: '1',
        clicks: '1',
        spend: '1',
        ctr: '1',
        inline_link_clicks: '8',
        outbound_clicks: [{ action_type: 'outbound_click', value: '6' }],
        unique_outbound_clicks: [{ action_type: 'outbound_click', value: '5' }],
        actions: [{ action_type: 'landing_page_view', value: '4' }],
      }),
    ).toEqual({
      inlineLinkClicks: 8,
      outboundClicks: 6,
      uniqueOutboundClicks: 5,
      landingPageViews: 4,
    })
  })

  it('extracts the destination and lead form from a creative', () => {
    expect(
      extractMetaCreativeDetails({
        id: 'ad',
        adset_id: 'set',
        campaign_id: 'campaign',
        name: 'Ad',
        status: 'ACTIVE',
        creative: {
          id: 'creative',
          object_url: 'https://doscientos.es/direct-destination',
          url_tags: 'utm_source=facebook',
          object_story_spec: {
            link_data: {
              link: 'https://doscientos.es/contact',
              call_to_action: { type: 'LEARN_MORE', value: { lead_gen_form_id: 'form' } },
            },
          },
        },
      }),
    ).toEqual({
      creativeId: 'creative',
      destinationUrl: 'https://doscientos.es/direct-destination',
      urlTags: 'utm_source=facebook',
      callToActionType: 'LEARN_MORE',
      leadFormId: 'form',
    })
  })
})
