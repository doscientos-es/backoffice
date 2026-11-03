'use client'

import { Avatar as AvatarPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '../lib/utils'

export { AvatarBadge, AvatarGroup, AvatarGroupCount } from '@doscientos/ui'

const SIZE = {
  xs: 'size-5 text-[10px]',
  sm: 'size-6 text-xs',
  default: 'size-8 text-sm',
  lg: 'size-10 text-base',
} as const

export type AvatarProps = ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: keyof typeof SIZE
}

/** Radix handles cached images and source changes without a late effect resetting loaded state. */
export function Avatar({ className, size = 'default', ...props }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        'group/avatar relative flex shrink-0 overflow-hidden rounded-full bg-muted text-muted-foreground',
        SIZE[size],
        className,
      )}
      {...props}
    />
  )
}

export function AvatarImage({
  className,
  alt = '',
  ...props
}: ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      alt={alt}
      className={cn('aspect-square size-full shrink-0 object-cover', className)}
      {...props}
    />
  )
}

export function AvatarFallback({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn('flex size-full items-center justify-center font-medium', className)}
      {...props}
    />
  )
}
