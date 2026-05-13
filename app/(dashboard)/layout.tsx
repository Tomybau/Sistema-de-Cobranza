import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileSidebar } from "@/components/layout/mobile-sidebar"
import { UserMenu } from "@/components/layout/user-menu"
import { CommandPalette } from "@/components/layout/command-palette"
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts"
import { Toaster } from "@/components/ui/sonner"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar desktop */}
      <div className="hidden md:flex w-52 shrink-0 border-r bg-background flex-col">
        <Sidebar />
      </div>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-12 items-center gap-3 border-b px-4 bg-background shrink-0">
          <MobileSidebar />
          <div className="flex-1" />

          {/* Ctrl+K trigger */}
          <button
            onClick={() => {
              const e = new KeyboardEvent("keydown", {
                key: "k",
                ctrlKey: true,
                bubbles: true,
              })
              window.dispatchEvent(e)
            }}
            className="hidden sm:flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <span>Buscar...</span>
            <kbd className="font-mono text-[10px]">Ctrl+K</kbd>
          </button>

          <UserMenu
            name={session.user.name ?? "Admin"}
            email={session.user.email ?? ""}
          />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-muted/20">
          {children}
        </main>
      </div>

      <Toaster richColors position="bottom-right" />
      <CommandPalette />
      <KeyboardShortcuts />
    </div>
  )
}
