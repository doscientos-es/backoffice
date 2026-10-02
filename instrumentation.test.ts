// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'

import { onRequestError } from './instrumentation'

describe('onRequestError', () => {
  afterEach(() => vi.restoreAllMocks())

  it('logs the original server error and digest without request secrets', async () => {
    const output = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = Object.assign(new ReferenceError('DOMMatrix is not defined'), { digest: '123' })
    await onRequestError(
      error,
      {
        path: '/internal-docs/doc-1?token=private',
        method: 'GET',
        headers: { cookie: 'private', authorization: 'private' },
      },
      {
        routerKind: 'App Router',
        routePath: '/internal-docs/[id]',
        routeType: 'render',
        revalidateReason: undefined,
      },
    )
    expect(output).toHaveBeenCalledWith('[server.request.error]', {
      name: 'ReferenceError',
      message: 'DOMMatrix is not defined',
      stack: error.stack,
      digest: '123',
      method: 'GET',
      path: '/internal-docs/doc-1',
      route: '/internal-docs/[id]',
      routeType: 'render',
      router: 'App Router',
    })
  })
})
