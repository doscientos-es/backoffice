import type { Instrumentation } from 'next'

/** Captures server rendering/action failures, including module initialization. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  // No env parsing or app imports: this must also work during startup failures.
  // Do not log headers, query strings, bodies, or signed URLs.
  console.error('[server.request.error]', {
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : 'Unknown server error',
    stack: error instanceof Error ? error.stack : undefined,
    digest: error instanceof Error && 'digest' in error ? error.digest : undefined,
    method: request.method,
    path: request.path.split('?')[0],
    route: context.routePath,
    routeType: context.routeType,
    router: context.routerKind,
  })
}
