import { Metadata } from "next"
import { TemplatesTable } from "@/components/email/templates-table"
import { getEmailTemplates } from "@/domain/email/queries"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Templates de Email | Sistema de Cobranza",
  description: "Gestión de templates de correos electrónicos",
}

export default async function EmailTemplatesPage() {
  const data = await getEmailTemplates()

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Templates de Email</h2>
        <Button asChild>
          <Link href="/email-templates/new">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Template
          </Link>
        </Button>
      </div>

      <TemplatesTable data={data} />
    </div>
  )
}
