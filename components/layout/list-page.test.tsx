import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const navigation = vi.hoisted(() => ({
  pathname: '/invoices',
  params: new URLSearchParams(),
  push: vi.fn(),
  prefetch: vi.fn(),
  replace: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({
    prefetch: navigation.prefetch,
    push: navigation.push,
    replace: navigation.replace,
  }),
  useSearchParams: () => navigation.params,
}))
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import { ListPage } from './list-page'

describe('ListPage', () => {
  beforeEach(() => {
    navigation.push.mockReset()
  })
  afterEach(cleanup)

  it('does not navigate the row when an inner link is clicked', () => {
    render(
      <ListPage
        title="Facturas"
        empty="Sin facturas"
        columns={[
          { key: 'factura', label: 'Factura' },
          { key: 'cliente', label: 'Cliente' },
        ]}
        rows={[
          {
            id: 'invoice-1',
            href: '/invoices/invoice-1',
            cells: {
              factura: { content: 'FAC-001' },
              cliente: {
                content: (
                  <a key="client" href="/clients/client-1">
                    Cliente
                  </a>
                ),
              },
            },
          },
        ]}
      />,
    )

    fireEvent.click(screen.getByRole('link', { name: 'Cliente' }))

    expect(navigation.push).not.toHaveBeenCalled()
  })

  it('keeps wide tables scrollable on small screens without compressing columns', () => {
    const { container } = render(
      <ListPage
        title="Facturas"
        empty="Sin facturas"
        columns={[{ key: 'factura', label: 'Factura' }]}
        rows={[{ id: 'invoice-1', cells: { factura: { content: 'FAC-001' } } }]}
      />,
    )
    const table = container.querySelector('table')

    expect(table?.className).toContain('min-w-max')
    expect(table?.className).toContain('sm:min-w-full')
    expect(table?.parentElement?.className).toContain('overflow-x-auto')
    expect(table?.parentElement?.className).toContain('overscroll-x-contain')
  })

  it('keeps bulk selection available on mobile cards and synchronized with the table', async () => {
    const onAction = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <ListPage
        title="Leads"
        empty="Sin leads"
        columns={[{ key: 'name', label: 'Nombre' }]}
        rows={[
          { id: 'lead-1', cells: { name: { content: 'Contacto uno', value: 'Contacto uno' } } },
          { id: 'lead-2', cells: { name: { content: 'Contacto dos', value: 'Contacto dos' } } },
        ]}
        mobileRow={(row) => <article>{row.cells.name?.content}</article>}
        bulkActions={[{ label: 'Asignarme', onAction }]}
      />,
    )
    const article = screen.getByText('Contacto uno', { selector: 'article' })
    const mobile = article.parentElement!.parentElement!.parentElement!
    const table = container.querySelector('table')!

    fireEvent.click(within(mobile).getByRole('checkbox', { name: 'Seleccionar Contacto uno' }))
    expect(
      (
        within(table).getByRole('checkbox', {
          name: 'Seleccionar Contacto uno',
        }) as HTMLInputElement
      ).checked,
    ).toBe(true)
    const selectPage = within(mobile).getByRole('checkbox', {
      name: 'Seleccionar esta página',
    }) as HTMLInputElement
    expect(selectPage.indeterminate).toBe(true)
    fireEvent.click(selectPage)
    expect(screen.getByText('2 seleccionadas')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Asignarme' }))
    await waitFor(() => expect(onAction).toHaveBeenCalledWith(['lead-1', 'lead-2']))
    await waitFor(() => expect(selectPage.checked).toBe(false))
  })
})
