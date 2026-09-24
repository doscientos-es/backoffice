import type { SVGProps } from 'react'

/** Compact Google Meet-style camera mark for meeting actions. */
export function GoogleMeetIcon({
  size = 14,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        fill="#00897B"
        d="M3 6.5A2.5 2.5 0 0 1 5.5 4h9A2.5 2.5 0 0 1 17 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 3 17z"
      />
      <path fill="#00AC47" d="m16 9 5-3v12l-5-3z" />
      <path fill="#4285F4" d="M3 14.5h14V17a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 3 17z" />
      <path fill="#EA4335" d="M16 9 21 6v5h-5z" />
      <path fill="#FBBC04" d="M16 13h5v5l-5-3z" />
    </svg>
  )
}
