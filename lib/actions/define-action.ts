import { revalidatePath } from 'next/cache'
import type { z } from 'zod'

import { type CurrentUser, type MemberRole, requireRole, requireUser } from '@/lib/auth'
import { isVersionConflictError } from '@/lib/concurrency/version-conflict'
import { scopedLogger } from '@/lib/logger'
import { formDataToObject } from '@/lib/schemas/common'

import type { ActionResult } from './types'

/**
 * Re-throw markers used by Next.js for redirect / notFound flow control.
 * These MUST propagate or the framework can't perform the navigation.
 */
function isFrameworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const digest = (err as { digest?: unknown }).digest
  return typeof digest === 'string' && digest.startsWith('NEXT_')
}

const FRIENDLY_ERRORS: Array<{ codes: string[]; pattern: RegExp; message: string }> = [
  {
    codes: ['23505'],
    pattern: /duplicate key/i,
    message: 'Ya existe un registro con esos datos.',
  },
  {
    codes: ['23503'],
    pattern: /violates foreign key constraint/i,
    message: 'No se puede completar: hay registros relacionados que lo impiden.',
  },
  {
    codes: ['23502'],
    pattern: /null value in column/i,
    message: 'Falta un dato obligatorio.',
  },
  {
    codes: ['23514', '22P02'],
    pattern: /violates check constraint|invalid input syntax/i,
    message: 'Algún dato no tiene un formato válido.',
  },
  {
    codes: ['42501'],
    pattern: /row-level security|permission denied/i,
    message: 'No tienes permisos para realizar esta acción.',
  },
  {
    codes: ['PGRST116'],
    pattern: /JSON object requested, multiple \(or no\) rows returned/i,
    message: 'No se encontró el registro; puede que se haya eliminado.',
  },
  {
    codes: [],
    pattern: /fetch failed|ECONNREFUSED|ECONNRESET|ETIMEDOUT|network error/i,
    message: 'Problema de conexión. Inténtalo de nuevo en unos segundos.',
  },
]

/** Translates raw database/network errors into actionable Spanish messages. */
export function friendlyErrorMessage(err: unknown): string {
  const raw = err && typeof err === 'object' ? (err as { message?: unknown; code?: unknown }) : null
  const message = typeof raw?.message === 'string' ? raw.message : ''
  const code = typeof raw?.code === 'string' ? raw.code : ''
  const match = FRIENDLY_ERRORS.find(
    (entry) => (code && entry.codes.includes(code)) || (message && entry.pattern.test(message)),
  )
  if (match) return match.message
  return message || 'Algo ha fallado. Inténtalo de nuevo.'
}

export type ActionContext = { user: CurrentUser }

export type DefineActionOptions<TSchema extends z.ZodTypeAny, TPayload> = {
  /** Stable name used for the scoped logger (e.g. "clients.update"). */
  name: string
  /** Zod schema for the input. Omit for actions that take no payload. */
  schema?: TSchema
  /** Restrict to these roles. When omitted, only `requireUser` is enforced. */
  roles?: MemberRole[]
  /** Paths to revalidate on success. Strings or `() => string[]`. */
  revalidate?: string[] | ((payload: TPayload, input: z.infer<TSchema>) => string[])
  /** The actual business logic. May throw `redirect()` / `notFound()`. */
  handler: (input: z.infer<TSchema>, ctx: ActionContext) => Promise<TPayload>
}

type Input<TSchema extends z.ZodTypeAny> = z.input<TSchema> | FormData

/**
 * Wraps a server action with: auth guard, Zod validation, structured logging,
 * uniform error envelope, and revalidation.
 *
 * The returned function is a server action that takes either the parsed input
 * shape or a `FormData` instance (auto-converted). Errors are returned as
 * `{ ok: false, error }`. `redirect()` / `notFound()` thrown inside the
 * handler propagate as-is so Next.js can perform navigation.
 */
export function defineAction<TSchema extends z.ZodTypeAny, TPayload>(
  options: DefineActionOptions<TSchema, TPayload>,
) {
  const log = scopedLogger(`action.${options.name}`)

  return async (rawInput?: Input<TSchema>): Promise<ActionResult<TPayload>> => {
    const fail = (error: string): ActionResult<TPayload> =>
      ({ ok: false, error }) as ActionResult<TPayload>

    try {
      const user = options.roles ? await requireRole(options.roles) : await requireUser()

      let input: z.infer<TSchema>
      if (options.schema) {
        const candidate: unknown =
          typeof FormData !== 'undefined' && rawInput instanceof FormData
            ? formDataToObject(rawInput)
            : (rawInput ?? {})
        const parsed = options.schema.safeParse(candidate)
        if (!parsed.success) {
          const msg = parsed.error.issues[0]?.message ?? 'Datos no válidos'
          log.warn({ issues: parsed.error.issues }, 'validation failed')
          return fail(msg)
        }
        input = parsed.data
      } else {
        input = undefined as z.infer<TSchema>
      }

      const payload = await options.handler(input, { user })

      const paths =
        typeof options.revalidate === 'function'
          ? options.revalidate(payload, input)
          : (options.revalidate ?? [])
      for (const p of paths) revalidatePath(p)

      return (
        payload === undefined ? { ok: true } : { ok: true, ...payload }
      ) as ActionResult<TPayload>
    } catch (err) {
      if (isFrameworkError(err)) throw err
      if (isVersionConflictError(err)) {
        return { ok: false, code: 'conflict', error: err.message } as ActionResult<TPayload>
      }
      log.error({ err }, 'action failed')
      return fail(friendlyErrorMessage(err))
    }
  }
}
