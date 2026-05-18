import { prisma } from "@/db/client"

export async function listNotifications(limit = 30) {
  return prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  })
}

export async function countUnreadNotifications() {
  return prisma.notification.count({ where: { isRead: false } })
}

export async function markNotificationRead(id: string) {
  return prisma.notification.update({
    where: { id },
    data: { isRead: true, readAt: new Date() },
  })
}

export async function markAllNotificationsRead() {
  return prisma.notification.updateMany({
    where: { isRead: false },
    data: { isRead: true, readAt: new Date() },
  })
}
