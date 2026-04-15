import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export async function getEmailTemplates() {
  return await prisma.emailTemplate.findMany({
    include: {
      company: {
        select: {
          legalName: true,
        }
      }
    },
    orderBy: [
      { company: { legalName: 'asc' } },
      { name: 'asc' }
    ]
  })
}

export async function getEmailTemplate(id: string) {
  return await prisma.emailTemplate.findUnique({
    where: { id },
  })
}
