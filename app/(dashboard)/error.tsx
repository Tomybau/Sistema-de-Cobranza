"use client"

import { useEffect } from "react"
import { AlertTriangle, Home, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Ocurrió un error inesperado</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          {error.message ?? "Algo salió mal al cargar esta página. Podés reintentar o volver al inicio."}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground font-mono">Ref: {error.digest}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset} variant="default" size="sm">
          <RotateCcw className="mr-2 h-4 w-4" />
          Reintentar
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">
            <Home className="mr-2 h-4 w-4" />
            Ir al inicio
          </Link>
        </Button>
      </div>
    </div>
  )
}
