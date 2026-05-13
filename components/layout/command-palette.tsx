"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Building2,
  FileText,
  Receipt,
  CreditCard,
  Mail,
  ClipboardList,
  Plus,
  Search,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: React.ElementType
  action: () => void
  group: "Navegar" | "Crear"
  shortcut?: string
}

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIdx, setActiveIdx] = useState(0)

  const items: CommandItem[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      description: "KPIs y métricas generales",
      icon: LayoutDashboard,
      action: () => router.push("/dashboard"),
      group: "Navegar",
      shortcut: "g d",
    },
    {
      id: "companies",
      label: "Empresas",
      description: "Listado de empresas clientes",
      icon: Building2,
      action: () => router.push("/companies"),
      group: "Navegar",
      shortcut: "g e",
    },
    {
      id: "contracts",
      label: "Contratos",
      description: "Listado de contratos",
      icon: FileText,
      action: () => router.push("/contracts"),
      group: "Navegar",
      shortcut: "g c",
    },
    {
      id: "tickets",
      label: "Tickets",
      description: "Tickets de cobro pendientes",
      icon: Receipt,
      action: () => router.push("/tickets"),
      group: "Navegar",
      shortcut: "g t",
    },
    {
      id: "payments",
      label: "Pagos",
      description: "Registro de pagos",
      icon: CreditCard,
      action: () => router.push("/payments"),
      group: "Navegar",
      shortcut: "g p",
    },
    {
      id: "templates",
      label: "Templates",
      description: "Templates de email",
      icon: Mail,
      action: () => router.push("/email-templates"),
      group: "Navegar",
    },
    {
      id: "audit",
      label: "Auditoría",
      description: "Registro de operaciones críticas",
      icon: ClipboardList,
      action: () => router.push("/audit"),
      group: "Navegar",
    },
    {
      id: "new-payment",
      label: "Registrar pago",
      description: "Abrir formulario de nuevo pago",
      icon: Plus,
      action: () => router.push("/payments/new"),
      group: "Crear",
      shortcut: "n p",
    },
    {
      id: "new-company",
      label: "Nueva empresa",
      description: "Agregar empresa cliente",
      icon: Plus,
      action: () => router.push("/companies/new"),
      group: "Crear",
    },
    {
      id: "new-contract",
      label: "Nuevo contrato",
      description: "Crear contrato",
      icon: Plus,
      action: () => router.push("/contracts/new"),
      group: "Crear",
    },
  ]

  const filtered = query.trim()
    ? items.filter(
        (it) =>
          it.label.toLowerCase().includes(query.toLowerCase()) ||
          it.description?.toLowerCase().includes(query.toLowerCase())
      )
    : items

  const groups = Array.from(new Set(filtered.map((i) => i.group)))

  const allFiltered = groups.flatMap((g) => filtered.filter((i) => i.group === g))

  const run = useCallback(
    (item: CommandItem) => {
      item.action()
      setOpen(false)
      setQuery("")
    },
    []
  )

  // Open with Ctrl+K / Cmd+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((v) => !v)
        setQuery("")
        setActiveIdx(0)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Arrow nav + Enter
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIdx((i) => Math.min(i + 1, allFiltered.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIdx((i) => Math.max(i - 1, 0))
      } else if (e.key === "Enter") {
        const item = allFiltered[activeIdx]
        if (item) run(item)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, allFiltered, activeIdx, run])

  // Reset active when query changes
  useEffect(() => {
    setActiveIdx(0)
  }, [query])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 gap-0 overflow-hidden max-w-lg">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        {/* Search input */}
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Buscar pantalla o acción..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 border-0 shadow-none focus-visible:ring-0 text-sm"
          />
          <kbd className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[340px] overflow-y-auto py-2">
          {allFiltered.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Sin resultados para &quot;{query}&quot;
            </p>
          ) : (
            groups.map((group) => {
              const groupItems = filtered.filter((i) => i.group === group)
              if (groupItems.length === 0) return null
              return (
                <div key={group}>
                  <p className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    {group}
                  </p>
                  {groupItems.map((item) => {
                    const globalIdx = allFiltered.indexOf(item)
                    return (
                      <button
                        key={item.id}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors",
                          globalIdx === activeIdx
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent/50"
                        )}
                        onMouseEnter={() => setActiveIdx(globalIdx)}
                        onClick={() => run(item)}
                      >
                        <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 text-left">
                          <span className="font-medium">{item.label}</span>
                          {item.description && (
                            <span className="ml-2 text-muted-foreground">
                              {item.description}
                            </span>
                          )}
                        </span>
                        {item.shortcut && (
                          <kbd className="shrink-0 font-mono text-[10px] text-muted-foreground">
                            {item.shortcut}
                          </kbd>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        <div className="border-t px-3 py-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span className="ml-auto">Ctrl+K para cerrar</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
