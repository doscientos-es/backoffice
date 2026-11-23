import { z } from 'zod'

// Limits keep anonymous requests and PDF rendering bounded. Coordinates use
// the signature pad's fixed 600 × 240 viewBox.
export const HandwrittenSignatureSchema = z
  .object({
    version: z.literal(1),
    strokes: z
      .array(
        z
          .array(
            z
              .object({
                x: z.number().finite().min(0).max(600),
                y: z.number().finite().min(0).max(240),
              })
              .strict(),
          )
          .min(1)
          .max(2000),
      )
      .min(1)
      .max(80),
  })
  .strict()
  .refine(
    (signature) => signature.strokes.reduce((sum, stroke) => sum + stroke.length, 0) <= 6000,
    'La firma es demasiado grande',
  )

export type HandwrittenSignature = z.infer<typeof HandwrittenSignatureSchema>

/** Matches the pad's SVG geometry, including a visible dot for a single point. */
export function handwrittenStrokePath(stroke: HandwrittenSignature['strokes'][number]): string {
  const coordinate = (value: number) => Math.round(value * 10) / 10
  const points = stroke.map(({ x, y }) => `${coordinate(x)} ${coordinate(y)}`)
  return points.length ? `M ${points.join(' L ')}${points.length === 1 ? ' h 0.01' : ''}` : ''
}
