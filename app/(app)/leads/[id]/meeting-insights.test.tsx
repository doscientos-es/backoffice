import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MeetingNextSteps } from './meeting-insights'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../../tasks/actions', () => ({ createTask: vi.fn() }))
vi.mock('../actions', () => ({ dismissMeetingNoShow: vi.fn() }))

afterEach(cleanup)

describe('MeetingNextSteps', () => {
  it('links the automatically created tasks without offering to create duplicates', () => {
    render(
      <MeetingNextSteps
        leadId="lead-test"
        steps={['Enviar propuesta (Ana)', 'Validar alcance']}
        automaticTaskIds={['task-one', 'task-two']}
      />,
    )
    expect(screen.getByText('2 tareas creadas automáticamente')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver tarea 1' }).getAttribute('href')).toBe(
      '/tasks/task-one',
    )
    expect(screen.queryByRole('button', { name: /Crear/ })).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('keeps manual task creation available for historical meetings', () => {
    render(<MeetingNextSteps leadId="lead-test" steps={['Revisar propuesta']} />)
    expect(screen.getByRole('button', { name: 'Crear 1 tarea' })).toBeTruthy()
    expect(screen.getByRole('checkbox')).toBeTruthy()
  })
})
