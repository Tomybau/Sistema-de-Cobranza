import { Metadata } from "next"
import { TemplateForm } from "@/components/email/template-form"
import { getCompaniesAction } from "@/app/actions/companies"

export const metadata: Metadata = {
  title: "Nuevo Template | Sistema de Cobranza",
}

export default async function NewTemplatePage() {
  // getCompaniesAction may act properly for lists, or we can just query from domain
  const { prisma } = await import("@/db/client")
  const companies = await prisma.company.findMany({
    where: { deletedAt: null },
    select: { id: true, legalName: true },
    orderBy: { legalName: "asc" }
  })

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Nuevo Template</h2>
      </div>

      <div className="mx-auto max-w-5xl mt-6">
        <TemplateForm companies={companies} />
      </div>
    </div>
  )
}
