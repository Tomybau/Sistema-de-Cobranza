import { prisma } from "@/db/client"
import type { NotificationType } from "@prisma/client"

export interface CreateNotificationInput {
  type: NotificationType
  title: string
  body?: string
  link?: string
  contractId?: string
  contractItemId?: string
}

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      contractId: input.contractId ?? null,
      contractItemId: input.contractItemId ?? null,
    },
  })
}
