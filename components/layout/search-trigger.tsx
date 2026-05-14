"use client"

import { Search } from "lucide-react"

export function SearchTrigger() {
  function openPalette() {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })
    )
  }

  return (
    <button
      onClick={openPalette}
      className="hidden sm:flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
    >
      <Search className="h-3.5 w-3.5" />
      <span>Buscar...</span>
      <kbd className="font-mono text-[10px]">Ctrl+K</kbd>
    </button>
  )
}
