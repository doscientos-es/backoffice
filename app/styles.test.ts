import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('global CSS imports', () => {
  it('loads application utilities after UI utilities while retaining preflight first', () => {
    const css = readFileSync('app/globals.css', 'utf8')
    const preflight = css.indexOf("@import 'tailwindcss/preflight'")
    const ui = css.indexOf("@import '@doscientos/ui/styles.css'")
    const utilities = css.indexOf("@import 'tailwindcss/utilities'")

    expect(preflight).toBeGreaterThanOrEqual(0)
    expect(ui).toBeGreaterThan(preflight)
    expect(utilities).toBeGreaterThan(ui)
  })
})
