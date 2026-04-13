"use client"

import { useState } from "react"
import { ArrowLeftRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ChangeStatusDialog } from "@/components/contracts/change-status-dialog"
import { DeleteContractButton } from "@/components/contracts/delete-contract-button"
import type { ContractStatus } from "@prisma/client"

interface Props {
  contractId: string
  contractStatus: ContractStatus
}

export function ContractDetailActions({ contractId, contractStatus }: Props) {
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)

  return (
    <div className="flex items-center gap-2 shrink-0">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setStatusDialogOpen(true)}
      >
        <ArrowLeftRight className="mr-2 h-4 w-4" />
        Cambiar estado
      </Button>
      <DeleteContractButton
        contractId={contractId}
        contractStatus={contractStatus}
      />

      <ChangeStatusDialog
        contractId={contractId}
        currentStatus={contractStatus}
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
      />
    </div>
  )
}
