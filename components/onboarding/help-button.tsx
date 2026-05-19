"use client"

import { HelpCircle } from "lucide-react"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { runTour } from "./tour-provider"

function getTourIdForPath(pathname: string): string | null {
  if (pathname === "/dashboard") return "dashboard"
  if (pathname === "/companies") return "companies"
  if (/^\/contracts\/[^/]+$/.test(pathname)) return "contractDetail"
  if (pathname === "/tickets") return "tickets"
  if (pathname === "/payments") return "payments"
  return null
}

export function HelpButton() {
  const pathname = usePathname()
  const tourId = pathname ? getTourIdForPath(pathname) : null
  if (!tourId) return null

  return (
    <Button
      variant="outline"
      size="icon"
      className="fixed bottom-6 right-6 z-40 h-10 w-10 rounded-full shadow-md"
      onClick={() => runTour(tourId)}
      title="Recorrido guiado de esta sección"
    >
      <HelpCircle className="h-5 w-5" />
    </Button>
  )
}
