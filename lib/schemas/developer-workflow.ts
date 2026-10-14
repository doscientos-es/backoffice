import { z } from 'zod'

export const SetTaskBlockerInput = z.object({
  taskId: z.string().uuid(),
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().min(1, 'Indica qué impide avanzar').max(1000).nullable(),
  ownerId: z.string().uuid().nullable().default(null),
  reviewOn: z.string().date().nullable().default(null),
})

export const LinkProjectRepositoryInput = z.object({
  projectId: z.string().uuid(),
  expectedVersion: z.number().int().positive(),
  repository: z
    .string()
    .trim()
    .max(500)
    .regex(
      /^https:\/\/github\.com\/[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]+\/?$/,
      'Usa https://github.com/organizacion/repositorio, sin parámetros',
    )
    .refine(
      (url) =>
        !['', '.', '..'].includes(
          url
            .replace(/\/$/, '')
            .split('/')
            .at(-1)
            ?.replace(/\.git$/, '') ?? '',
        ),
      'Nombre de repositorio inválido',
    ),
})
