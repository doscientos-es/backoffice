import Image from 'next/image'

/** Official 2026 Google Meet logo, preserving its original aspect ratio. */
export function GoogleMeetIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/icons/google-meet-2026.svg"
      alt=""
      width={Math.round((176 / 138) * size)}
      height={size}
      className={className}
      aria-hidden="true"
    />
  )
}
