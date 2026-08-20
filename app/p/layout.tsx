export const metadata = {
  title: "Portal · doscientos",
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-zinc-900">
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl lg:max-w-6xl">{children}</div>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex h-11 w-full max-w-6xl items-center justify-between px-4 text-xs text-zinc-400 dark:text-zinc-600 sm:px-6">
          <span>© {new Date().getFullYear()} doscientos</span>
          <span>No compartas este enlace</span>
        </div>
      </footer>
    </div>
  );
}
