"use client"

import { useState, useTransition } from "react"
import { Bell, CheckCheck, ExternalLink, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/app/(dashboard)/notifications/actions"

export interface NotificationItem {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  isRead: boolean
  createdAt: Date
}

interface Props {
  initialNotifications: NotificationItem[]
  unreadCount: number
}

const TYPE_STYLES: Record<string, { dot: string; icon: string }> = {
  BILLING_REMINDER: { dot: "bg-amber-400", icon: "🔔" },
  AUTO_GENERATED: { dot: "bg-green-500", icon: "✅" },
  AUTO_GENERATE_ERROR: { dot: "bg-destructive", icon: "⚠️" },
}

export function NotificationBell({ initialNotifications, unreadCount: initialUnread }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState(initialNotifications)
  const [unreadCount, setUnreadCount] = useState(initialUnread)
  const [isPending, startTransition] = useTransition()

  function handleMarkRead(id: string) {
    startTransition(async () => {
      await markNotificationReadAction(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    })
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsReadAction()
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    })
  }

  function handleClickNotification(n: NotificationItem) {
    if (!n.isRead) handleMarkRead(n.id)
    if (n.link) {
      setOpen(false)
      router.push(n.link)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="relative inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors">
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0" sideOffset={6}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Notificaciones</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {unreadCount}
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
              onClick={handleMarkAllRead}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCheck className="h-3 w-3" />
              )}
              Marcar todas
            </button>
          )}
        </div>

        {/* Lista */}
        <div className="max-h-[420px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Sin notificaciones
            </div>
          ) : (
            notifications.map((n) => {
              const style = TYPE_STYLES[n.type] ?? { dot: "bg-muted-foreground", icon: "ℹ️" }
              return (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 border-b last:border-0 cursor-pointer transition-colors hover:bg-muted/50",
                    !n.isRead && "bg-primary/5"
                  )}
                  onClick={() => handleClickNotification(n)}
                >
                  {/* Indicador de tipo */}
                  <div className="mt-1 shrink-0 flex flex-col items-center gap-1">
                    <span className="text-base leading-none">{style.icon}</span>
                    {!n.isRead && (
                      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm leading-snug", !n.isRead && "font-medium")}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {n.body}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(n.createdAt), "dd MMM HH:mm", { locale: es })}
                    </p>
                  </div>

                  {n.link && (
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                </div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
