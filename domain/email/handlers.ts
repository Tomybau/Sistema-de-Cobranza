import { PrismaClient } from "@prisma/client"
import { z } from "zod"
import { validateTemplate } from "./interpolate"

const prisma = new PrismaClient()

export const CreateEmailTemplateSchema = z.object({
  companyId: z.string().min(1, "La empresa es obligatoria"),
  name: z.string().min(1, "El nombre es obligatorio"),
  subject: z.string().min(1, "El asuto es obligatorio"),
  bodyHtml: z.string().min(1, "El cuerpo del email es obligatorio"),
  isDefault: z.boolean().default(false),
})

export type CreateEmailTemplateInput = z.infer<typeof CreateEmailTemplateSchema>

export const UpdateEmailTemplateSchema = CreateEmailTemplateSchema.partial()

export type UpdateEmailTemplateInput = z.infer<typeof UpdateEmailTemplateSchema>

export async function createTemplate(input: CreateEmailTemplateInput) {
  const validatedData = CreateEmailTemplateSchema.parse(input)

  const validation = validateTemplate(validatedData.subject, validatedData.bodyHtml)
  if (!validation.isValid) {
    throw new Error(`Variables inválidas: ${validation.invalidVariables.join(", ")}`)
  }

  return await prisma.$transaction(async (tx) => {
    // Si isDefault es true, desactivar otros de la misma compañía
    if (validatedData.isDefault) {
      await tx.emailTemplate.updateMany({
        where: { companyId: validatedData.companyId },
        data: { isDefault: false },
      })
    }

    return await tx.emailTemplate.create({
      data: {
        companyId: validatedData.companyId,
        name: validatedData.name,
        subject: validatedData.subject,
        bodyHtml: validatedData.bodyHtml,
        isDefault: validatedData.isDefault,
      },
    })
  })
}

export async function updateTemplate(id: string, input: UpdateEmailTemplateInput) {
  const validatedData = UpdateEmailTemplateSchema.parse(input)

  const template = await prisma.emailTemplate.findUnique({
    where: { id }
  })

  if (!template) throw new Error("Template no encontrado")

  const subject = validatedData.subject ?? template.subject
  const bodyHtml = validatedData.bodyHtml ?? template.bodyHtml

  const validation = validateTemplate(subject, bodyHtml)
  if (!validation.isValid) {
    throw new Error(`Variables inválidas: ${validation.invalidVariables.join(", ")}`)
  }

  return await prisma.$transaction(async (tx) => {
    const isDefault = validatedData.isDefault ?? template.isDefault

    if (isDefault) {
      await tx.emailTemplate.updateMany({
        where: { companyId: template.companyId, id: { not: id } },
        data: { isDefault: false },
      })
    }

    return await tx.emailTemplate.update({
      where: { id },
      data: validatedData,
    })
  })
}

export async function deleteTemplate(id: string) {
  const template = await prisma.emailTemplate.findUnique({
    where: { id },
    include: {
      _count: {
        select: { emailLogs: true }
      }
    }
  })

  if (!template) throw new Error("Template no encontrado")
  
  if (template._count.emailLogs > 0) {
    throw new Error("No se puede eliminar un template que tiene envíos asociados")
  }

  return await prisma.emailTemplate.delete({
    where: { id }
  })
}

export async function setDefaultTemplate(id: string, companyId: string) {
  return await prisma.$transaction(async (tx) => {
    await tx.emailTemplate.updateMany({
      where: { companyId },
      data: { isDefault: false },
    })

    return await tx.emailTemplate.update({
      where: { id },
      data: { isDefault: true },
    })
  })
}
