import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  Kbd,
  KbdGroup,
  Separator,
  SubmitButton,
  Avatar,
  AvatarFallback,
  AvatarImage,
  FormFeedback,
  FormRow,
} from '@doscientos/ui'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

describe('@doscientos/ui adapters', () => {
  it('renders accessible form feedback from the package', () => {
    render(<FormFeedback state={{ status: 'success' }} />)

    expect(screen.getByRole('status').textContent).toContain('Guardado')
  })

  it('keeps labels and errors associated in form rows', () => {
    render(
      <FormRow label="Nombre" htmlFor="name" error="Campo obligatorio">
        <input id="name" />
      </FormRow>,
    )

    expect(screen.getByLabelText('Nombre')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('Campo obligatorio')
  })

  it('groups keyboard shortcuts without nesting kbd elements', () => {
    const { container } = render(
      <KbdGroup>
        <Kbd>Ctrl</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>,
    )

    const group = container.querySelector('[data-slot="kbd-group"]')
    expect(group?.tagName).toBe('SPAN')
    expect(group?.querySelectorAll('kbd')).toHaveLength(2)
  })

  it('marks a loaded avatar image and hides its fallback through CSS', () => {
    render(
      <Avatar>
        <AvatarImage src="/ana.jpg" alt="Ana" />
        <AvatarFallback>AN</AvatarFallback>
      </Avatar>,
    )

    const image = screen.getByRole('img', { name: 'Ana' })
    fireEvent.load(image)
    expect(image.hasAttribute('data-loaded')).toBe(true)
    expect(screen.getByText('AN').className).toContain(
      'group-has-[[data-slot=avatar-image][data-loaded]]/avatar:invisible',
    )
  })

  it('uses the package separator with its accessible orientation', () => {
    render(<Separator orientation="vertical" />)

    expect(screen.getByRole('separator').getAttribute('aria-orientation')).toBe('vertical')
  })

  it('composes accessible button groups from the package', () => {
    render(
      <ButtonGroup aria-label="Paginación">
        <ButtonGroupText>Página 1</ButtonGroupText>
        <ButtonGroupSeparator />
      </ButtonGroup>,
    )

    expect(screen.getByRole('group', { name: 'Paginación' })).toBeTruthy()
    expect(screen.getByText('Página 1').getAttribute('data-slot')).toBe('button-group-text')
    expect(screen.getByRole('separator').getAttribute('data-slot')).toBe('button-group-separator')
  })

  it('uses the package submit button while a client form is loading', () => {
    const onSubmit = vi.fn()
    render(
      <form onSubmit={onSubmit}>
        <SubmitButton loading pendingLabel="Guardando…">
          Guardar
        </SubmitButton>
      </form>,
    )

    const button = screen.getByRole('button', { name: 'Guardando…' })
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.getAttribute('type')).toBe('button')
    fireEvent.click(button)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
