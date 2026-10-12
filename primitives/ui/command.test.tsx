import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CommandDialog, CommandInput } from './command'

describe('CommandDialog', () => {
  it('applies the command palette mobile layout and renders a standard search field', () => {
    const { rerender } = render(
      <CommandDialog open onOpenChange={vi.fn()}>
        <CommandInput placeholder="Buscar…" />
      </CommandDialog>,
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('max-sm:top-[var(--command-palette-offset-top,0px)]')
    expect(dialog.className).toContain('max-sm:fixed')
    expect(dialog.className).toContain('max-sm:w-screen!')
    expect(dialog.className).toContain('max-sm:max-w-none!')
    expect(dialog.className).toContain('max-sm:h-[var(--command-palette-height,100svh)]')
    expect(dialog.className).not.toContain('top-1/3')

    const input = screen.getByPlaceholderText('Buscar…')
    expect(input.className).toContain('rounded-lg')
    expect(input.className).toContain('border-border')
    expect(input.className).toContain('pl-8')
    expect(input.className).toContain('max-sm:h-11')
    expect(input.className).toContain('max-sm:text-base')

    rerender(
      <CommandDialog open onOpenChange={vi.fn()}>
        <CommandInput autoFocus placeholder="Buscar…" />
      </CommandDialog>,
    )

    expect(document.activeElement).toBe(input)
  })
})
