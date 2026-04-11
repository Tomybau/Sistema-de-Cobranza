"use client"

import { useTransition } from "react"
import { RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { restoreCompanyAction } from "@/app/(dashboard)/companies/actions"

interface RestoreCompanyButtonProps {
  companyId: string
}

export function RestoreCompanyButton({ companyId }: RestoreCompanyButtonProps) {
  const [isPending, startTransition] = useTransition()

  function handleRestore() {
    startTransition(async () => {
      const result = await restoreCompanyAction(companyId)
      if (!result.success) {
        toast.error(result.error)
      }
      // Si success: la action redirige
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRestore}
      disabled={isPending}
    >
      <RotateCcw className="mr-2 h-4 w-4" />
      Restaurar
    </Button>
  )
}
