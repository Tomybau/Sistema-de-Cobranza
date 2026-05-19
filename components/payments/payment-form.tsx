"use client"

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import { getClientTicketsAction, createPaymentAction } from "@/app/actions/payments"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatMoney } from "@/lib/money"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import { Paperclip, X } from "lucide-react"
import type { PaymentMethod } from "@prisma/client"

type ClientOption = {
  id: string
  name: string
}

type TicketItem = Awaited<ReturnType<typeof getClientTicketsAction>>["tickets"][0]

interface PaymentFormProps {
  clients: ClientOption[]
  onSuccess?: () => void
  embedded?: boolean
}

export function PaymentForm({ clients, onSuccess, embedded }: PaymentFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isLoadingTickets, setIsLoadingTickets] = useState(false)

  const [clientId, setClientId] = useState("")
  const [companyId, setCompanyId] = useState("")
  const [method, setMethod] = useState<PaymentMethod | "">("")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0])

  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [allocations, setAllocations] = useState<Record<string, string>>({})

  const [attachment, setAttachment] = useState<File | null>(null)
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const [clientSearch, setClientSearch] = useState("")

  const handleClientChange = async (selectedClientId: string | null) => {
    const validId = selectedClientId ?? ""
    setClientId(validId)
    if (!validId) {
      setTickets([])
      setAllocations({})
      setSelectedIds(new Set())
      return
    }

    setIsLoadingTickets(true)
    try {
      const data = await getClientTicketsAction(validId)
      setCompanyId(data.companyId)
      setTickets(data.tickets)
      setAllocations({})
      setSelectedIds(new Set())
    } catch {
      toast.error("Error al cargar tickets del cliente")
      setTickets([])
      setAllocations({})
    } finally {
      setIsLoadingTickets(false)
    }
  }

  const parseCurrencyInput = (val: string) => val.replace(/,/g, "")

  const formatInputCurrency = (val: string) => {
    if (!val) return ""
    let clean = val.replace(/[^\d.]/g, "")
    const parts = clean.split(".")
    if (parts.length > 2) clean = parts[0] + "." + parts.slice(1).join("")
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    return parts.length > 1 ? `${integerPart}.${parts[1]}` : integerPart
  }

  const remainingForTicket = (t: TicketItem): number => {
    const amount = parseFloat(t.amount.toString())
    const paid = parseFloat(t.paidAmount.toString())
    return Math.max(0, amount - paid)
  }

  const toggleTicket = (t: TicketItem) => {
    const id = t.id
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
    setAllocations((prev) => {
      if (prev[id] !== undefined && selectedIds.has(id)) {
        const copy = { ...prev }
        delete copy[id]
        return copy
      }
      return { ...prev, [id]: remainingForTicket(t).toFixed(2) }
    })
  }

  const handleAllocationChange = (ticketId: string, val: string) => {
    setAllocations((prev) => ({ ...prev, [ticketId]: parseCurrencyInput(val) }))
  }

  const totalAllocated = Array.from(selectedIds).reduce((acc, id) => {
    const v = parseFloat(allocations[id] ?? "0")
    return acc + (isNaN(v) ? 0 : v)
  }, 0)

  const currency = tickets[0]?.currency ?? "USD"

  const onSubmit = () => {
    if (!clientId) return toast.error("Seleccioná un cliente")
    if (!method) return toast.error("Seleccioná un método de pago")
    if (!paymentDate) return toast.error("Seleccioná una fecha")
    if (selectedIds.size === 0) return toast.error("Seleccioná al menos un ticket")
    if (totalAllocated <= 0) return toast.error("El total asignado debe ser mayor a 0")

    // Validar que cada allocation no exceda el restante del ticket
    for (const id of selectedIds) {
      const t = tickets.find((x) => x.id === id)
      if (!t) continue
      const v = parseFloat(allocations[id] ?? "0")
      if (isNaN(v) || v <= 0) return toast.error(`Monto inválido para ticket ${t.ticketNumber}`)
      if (v > remainingForTicket(t)) {
        return toast.error(`El monto de ${t.ticketNumber} supera lo que falta cobrar`)
      }
    }

    const finalAllocations = Array.from(selectedIds).map((id) => ({
      ticketId: id,
      allocatedAmount: allocations[id],
    }))

    startTransition(async () => {
      const res = await createPaymentAction(
        {
          companyId,
          clientId,
          grossAmount: totalAllocated.toFixed(2),
          method: method as PaymentMethod,
          paymentDate: new Date(paymentDate),
          reference: reference || undefined,
          notes: notes || undefined,
          allocations: finalAllocations,
        },
        attachment ?? undefined
      )

      if (!res.success) {
        toast.error(res.error)
      } else {
        toast.success("Pago registrado correctamente")
        if (onSuccess) onSuccess()
        else router.push("/payments")
      }
    })
  }

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  )

  const Wrapper = embedded ? "div" : Card
  const Body = embedded ? "div" : CardContent
  const Header = embedded ? "div" : CardHeader
  const Footer = embedded ? "div" : CardFooter

  const form = (
    <>
      {!embedded && (
        <Header>
          <CardTitle>Detalles del pago</CardTitle>
        </Header>
      )}
      <Body className={embedded ? "space-y-6" : "space-y-6"}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>Cliente / Empresa</Label>
            <Select
              value={clientId}
              onValueChange={handleClientChange}
              items={Object.fromEntries(clients.map((c) => [c.id, c.name]))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná un cliente…" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <div
                  className="p-2 sticky top-0 bg-popover z-10 border-b"
                  onPointerDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <Input
                    placeholder="Filtrar por nombre…"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                {filteredClients.length > 0 ? (
                  filteredClients.map((c) => (
                    <SelectItem key={c.id} value={c.id} label={c.name}>
                      {c.name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground border-t mt-1">
                    No se encontraron clientes.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Método de pago</Label>
            <Select
              value={method}
              onValueChange={(v) => setMethod(v as PaymentMethod)}
              items={{
                BANK_TRANSFER: "Transferencia",
                CHECK: "Cheque",
                CASH: "Efectivo",
                CREDIT_CARD: "Tarjeta",
                OTHER: "Otro",
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BANK_TRANSFER" label="Transferencia">Transferencia</SelectItem>
                <SelectItem value="CHECK" label="Cheque">Cheque</SelectItem>
                <SelectItem value="CASH" label="Efectivo">Efectivo</SelectItem>
                <SelectItem value="CREDIT_CARD" label="Tarjeta">Tarjeta</SelectItem>
                <SelectItem value="OTHER" label="Otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fecha de pago</Label>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Referencia (opcional)</Label>
            <Input
              placeholder="# cheque o tx"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Adjunto (opcional, máx 5MB)</Label>
            <input
              ref={attachmentInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f && f.size > 5 * 1024 * 1024) {
                  toast.error("El archivo supera 5MB")
                  e.target.value = ""
                  return
                }
                setAttachment(f ?? null)
              }}
            />
            {attachment ? (
              <div className="flex items-center gap-2 text-sm rounded-md border px-3 py-2 h-9">
                <Paperclip className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{attachment.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setAttachment(null)
                    if (attachmentInputRef.current) attachmentInputRef.current.value = ""
                  }}
                  className="shrink-0 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => attachmentInputRef.current?.click()}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground rounded-md border border-dashed px-3 py-2 h-9 w-full"
              >
                <Paperclip className="h-4 w-4" />
                Adjuntar comprobante
              </button>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Notas (opcional)</Label>
            <Textarea
              placeholder="Observaciones…"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {clientId && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Tickets a cubrir con este pago
              </h3>
              <div className="text-sm">
                Total asignado:{" "}
                <span className="font-semibold tabular-nums">
                  {formatMoney(totalAllocated, currency)}
                </span>
              </div>
            </div>

            {isLoadingTickets ? (
              <p className="text-sm text-muted-foreground">Cargando tickets…</p>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este cliente no tiene tickets pendientes.
              </p>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="w-10 p-2" />
                      <th className="p-2 text-left font-medium">Ticket</th>
                      <th className="p-2 text-right font-medium">Pendiente</th>
                      <th className="p-2 text-right font-medium">Asignar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => {
                      const remaining = remainingForTicket(t)
                      const isChecked = selectedIds.has(t.id)
                      return (
                        <tr key={t.id} className="border-b last:border-0">
                          <td className="p-2 text-center">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleTicket(t)}
                            />
                          </td>
                          <td className="p-2">
                            <div className="font-medium">{t.ticketNumber}</div>
                            <div className="text-xs text-muted-foreground">
                              {t.contractItem.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Vcto: {format(new Date(t.dueDate), "dd MMM yyyy", { locale: es })}
                            </div>
                          </td>
                          <td className="p-2 text-right tabular-nums">
                            {formatMoney(remaining, t.currency)}
                          </td>
                          <td className="p-2 text-right">
                            <Input
                              type="text"
                              className="w-28 ml-auto text-right h-8"
                              placeholder="0.00"
                              value={formatInputCurrency(allocations[t.id] ?? "")}
                              onChange={(e) => handleAllocationChange(t.id, e.target.value)}
                              disabled={!isChecked}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Body>
      <Footer className="flex justify-end gap-3">
        {!embedded && (
          <Button variant="outline" onClick={() => router.push("/payments")} disabled={isPending}>
            Cancelar
          </Button>
        )}
        <Button
          onClick={onSubmit}
          disabled={isPending || !clientId || selectedIds.size === 0 || totalAllocated <= 0}
        >
          {isPending ? "Registrando…" : "Registrar pago"}
        </Button>
      </Footer>
    </>
  )

  return embedded ? <div className="space-y-6">{form}</div> : <Wrapper>{form}</Wrapper>
}
