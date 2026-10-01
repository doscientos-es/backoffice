import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { GmailIcon } from './gmail-icon'
import { GoogleCalendarIcon } from './google-calendar-icon'
import { GoogleMeetIcon } from './google-meet-icon'

describe('Google brand icons', () => {
  it('renders the official local SVG assets as decorative images', () => {
    const { container } = render(
      <>
        <GoogleMeetIcon />
        <GmailIcon />
        <GoogleCalendarIcon />
      </>,
    )

    const images = [...container.querySelectorAll('img')]
    expect(images.map((image) => image.getAttribute('src'))).toEqual([
      '/icons/google-meet-2026.svg',
      '/icons/gmail-2026.svg',
      '/icons/google-calendar-2026.svg',
    ])
    expect(images.every((image) => image.getAttribute('alt') === '')).toBe(true)
  })
})
