"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

const SHORTCUT_MAP: Record<string, string> = {
  "g d": "/dashboard",
  "g e": "/companies",
  "g c": "/contracts",
  "g t": "/tickets",
  "g p": "/payments",
  "g a": "/audit",
  "n p": "/payments/new",
  "n e": "/companies/new",
  "n c": "/contracts/new",
}

export function KeyboardShortcuts() {
  const router = useRouter()
  const buffer = useRef("")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Skip if user is typing in an input / textarea / contenteditable
      const target = e.target as HTMLElement
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return
      }

      buffer.current += e.key
      if (timer.current) clearTimeout(timer.current)

      const route = SHORTCUT_MAP[buffer.current]
      if (route) {
        router.push(route)
        buffer.current = ""
        return
      }

      // If no full match but partial possible, wait 500ms for second key
      const hasPartial = Object.keys(SHORTCUT_MAP).some((k) =>
        k.startsWith(buffer.current)
      )
      if (!hasPartial) {
        buffer.current = ""
        return
      }

      timer.current = setTimeout(() => {
        buffer.current = ""
      }, 500)
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router])

  return null
}
