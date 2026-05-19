"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { TOURS } from "@/lib/onboarding/tours"

function getTourIdForPath(pathname: string): string | null {
  if (pathname === "/dashboard") return "dashboard"
  if (pathname === "/companies") return "companies"
  if (/^\/contracts\/[^/]+$/.test(pathname)) return "contractDetail"
  if (pathname === "/tickets") return "tickets"
  if (pathname === "/payments") return "payments"
  return null
}

function flagKey(tourId: string) {
  return `onboarding:v1:${tourId}`
}

export function TourProvider() {
  const pathname = usePathname()
  const launched = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!pathname) return
    const tourId = getTourIdForPath(pathname)
    if (!tourId) return
    if (launched.current.has(tourId)) return
    if (typeof window === "undefined") return
    if (window.localStorage.getItem(flagKey(tourId))) return

    let cancelled = false
    const timer = window.setTimeout(async () => {
      if (cancelled) return
      await runTour(tourId)
      window.localStorage.setItem(flagKey(tourId), "1")
      launched.current.add(tourId)
    }, 500)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [pathname])

  return null
}

export async function runTour(tourId: string) {
  const tour = TOURS[tourId]
  if (!tour) return

  const { driver } = await import("driver.js")
  // Cargar CSS via link tag (evita resolución TS del .css del package)
  if (typeof document !== "undefined" && !document.getElementById("driver-css")) {
    const link = document.createElement("link")
    link.id = "driver-css"
    link.rel = "stylesheet"
    link.href = "https://cdn.jsdelivr.net/npm/driver.js@1.3.6/dist/driver.css"
    document.head.appendChild(link)
  }

  const validSteps = tour.steps.filter((s) => document.querySelector(s.selector))
  if (validSteps.length === 0) return

  const d = driver({
    showProgress: true,
    nextBtnText: "Siguiente",
    prevBtnText: "Anterior",
    doneBtnText: "Listo",
    progressText: "{{current}} de {{total}}",
    steps: validSteps.map((s) => ({
      element: s.selector,
      popover: {
        title: s.title,
        description: s.description,
        side: s.side ?? "bottom",
      },
    })),
  })

  d.drive()
}
