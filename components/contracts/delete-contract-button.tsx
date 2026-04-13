"use client"

import { useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { softDeleteContractAction } from "@/app/(dashboard)/contracts/actions"

interface Props {
  contractId: string
  contractStatus: string
}

export function DeleteContractButton({ contractId, contractStatus }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isActive = contractStatus === "ACTIVE"

  function handleDelete() {
    startTransition(async () => {
      const result = await softDeleteContractAction(contractId)
      if (!result.success) {
        toast.error(result.error)
        setOpen(false)
      }
    })
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => {
          if (isActive) {
            toast.error(
              "No se puede eliminar un contrato activo. Suspendelo o finalizalo primero."
            )
            return
          }
          setOpen(true)
        }}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Eliminar
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              El contrato quedará marcado como eliminado y no aparecerá en el
              listado. Esta acción se puede revertir si fuera necesario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
