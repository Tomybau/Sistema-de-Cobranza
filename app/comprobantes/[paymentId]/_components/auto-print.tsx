"use client"

import { useEffect } from "react"

export function AutoPrint({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    function setupButton() {
      const btn = document.querySelector<HTMLButtonElement>('button[data-print="true"]')
      if (btn) btn.onclick = () => window.print()
    }
    setupButton()
    if (enabled) {
      const t = window.setTimeout(() => window.print(), 400)
      return () => window.clearTimeout(t)
    }
  }, [enabled])
  return null
}
