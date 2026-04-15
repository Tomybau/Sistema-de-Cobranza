"use server"

import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { 
  createTemplate, 
  updateTemplate, 
  deleteTemplate, 
  setDefaultTemplate,
  CreateEmailTemplateInput,
  UpdateEmailTemplateInput
} from "@/domain/email/handlers"

export type ActionResult<T = void> = 
  | { success: true; data?: T }
  | { success: false; error: string }

export async function createEmailTemplateAction(input: CreateEmailTemplateInput): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "No autorizado." }
  }

  try {
    await createTemplate(input)
    revalidatePath("/email-templates")
    return { success: true }
  } catch (error) {
    console.error("[createEmailTemplateAction] Error:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Error al crear el template." 
    }
  }
}

export async function updateEmailTemplateAction(id: string, input: UpdateEmailTemplateInput): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "No autorizado." }
  }

  try {
    await updateTemplate(id, input)
    revalidatePath("/email-templates")
    revalidatePath(`/email-templates/${id}/edit`)
    return { success: true }
  } catch (error) {
    console.error("[updateEmailTemplateAction] Error:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Error al actualizar el template." 
    }
  }
}

export async function deleteEmailTemplateAction(id: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "No autorizado." }
  }

  try {
    await deleteTemplate(id)
    revalidatePath("/email-templates")
    return { success: true }
  } catch (error) {
    console.error("[deleteEmailTemplateAction] Error:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Error al eliminar el template." 
    }
  }
}

export async function setDefaultTemplateAction(id: string, companyId: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "No autorizado." }
  }

  try {
    await setDefaultTemplate(id, companyId)
    revalidatePath("/email-templates")
    return { success: true }
  } catch (error) {
    console.error("[setDefaultTemplateAction] Error:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Error al establecer default." 
    }
  }
}
