import Image from 'next/image'

/** Official 2026 Gmail logo, preserving its original aspect ratio. */
export function GmailIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/icons/gmail-2026.svg"
      alt=""
      width={Math.round((800 / 636.36322) * size)}
      height={size}
      className={className}
      aria-hidden="true"
    />
  )
}
