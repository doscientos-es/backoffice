import { PortalLanguageSwitch } from '@/components/portal/language-switch'

/**
 * Deck layout — full-screen, no chrome.
 * Intentionally avoids the portal header/footer so slides fill the viewport.
 */
export const metadata = {
  title: 'Presentación · doscientos',
  robots: { index: false, follow: false },
}

export default function DeckLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="fixed top-3 right-3 z-50 sm:top-4 sm:right-5">
        <PortalLanguageSwitch />
      </div>
      {children}
    </>
  )
}
