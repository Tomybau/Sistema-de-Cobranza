import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileSidebar } from "@/components/layout/mobile-sidebar"
import { UserMenu } from "@/components/layout/user-menu"
import { CommandPalette } from "@/components/layout/command-palette"
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts"
import { SearchTrigger } from "@/components/layout/search-trigger"
import { Toaster } from "@/components/ui/sonner"
import { NotificationBell } from "@/components/layout/notification-bell"
import { listNotifications, countUnreadNotifications } from "@/domain/notifications/queries"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const [notifications, unreadCount] = await Promise.all([
    listNotifications(30),
    countUnreadNotifications(),
  ])

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

          <SearchTrigger />

          <NotificationBell
            initialNotifications={notifications.map((n) => ({
              id: n.id,
              type: n.type,
              title: n.title,
              body: n.body,
              link: n.link,
              isRead: n.isRead,
              createdAt: n.createdAt,
            }))}
            unreadCount={unreadCount}
          />

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
