import Image from 'next/image'

/** Official 2026 Google Calendar logo, preserving its original aspect ratio. */
export function GoogleCalendarIcon({
  size = 14,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <Image
      src="/icons/google-calendar-2026.svg"
      alt=""
      width={Math.round((800 / 859.0954) * size)}
      height={size}
      className={className}
      aria-hidden="true"
    />
  )
}
