import { Metadata } from "next"
import { notFound } from "next/navigation"
import { TemplateForm } from "@/components/email/template-form"
import { getEmailTemplate } from "@/domain/email/queries"

export const metadata: Metadata = {
  title: "Editar Template | Sistema de Cobranza",
}

interface EditTemplatePageProps {
  params: Promise<{ id: string }>
}

export default async function EditTemplatePage({ params }: EditTemplatePageProps) {
  const { id } = await params
  const template = await getEmailTemplate(id)

  if (!template) {
    notFound()
  }

  const { prisma } = await import("@/db/client")
  const companies = await prisma.company.findMany({
    where: { deletedAt: null },
    select: { id: true, legalName: true },
    orderBy: { legalName: "asc" }
  })

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Editar Template</h2>
      </div>

      <div className="mx-auto max-w-5xl mt-6">
        <TemplateForm companies={companies} initialData={template} />
      </div>
    </div>
  )
}
