import type { SVGProps } from 'react'

/** Gmail mark, sized to match the other compact action icons. */
export function GmailIcon({ size = 14, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="#EA4335"
      aria-hidden
      {...props}
    >
      <path d="M24 5.457v13.086c0 1.186-.962 2.148-2.148 2.148H2.148A2.148 2.148 0 0 1 0 18.543V5.457c0-.892.543-1.657 1.316-1.983l.001-.001L12 11.261l10.683-7.788.001.001A2.148 2.148 0 0 1 24 5.457M2.148 3.31C.962 3.31 0 4.272 0 5.457c0 .697.34 1.346.911 1.749l.001-.001 5.735 4.18v9.306h10.704v-9.306l5.735-4.18.001.001c.571-.403.911-1.052.911-1.749 0-1.185-.962-2.148-2.148-2.148H2.148Z" />
    </svg>
  )
}