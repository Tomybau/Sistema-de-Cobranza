"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { getClientTicketsAction, createPaymentAction } from "@/app/actions/payments"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
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
import type { PaymentMethod } from "@prisma/client"

type ClientOption = {
  id: string
  name: string
}

type TicketItem = Awaited<ReturnType<typeof getClientTicketsAction>>["tickets"][0]

interface PaymentFormProps {
  clients: ClientOption[]
}

export function PaymentForm({ clients }: PaymentFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isLoadingTickets, setIsLoadingTickets] = useState(false)
  
  // Basic Form State
  const [clientId, setClientId] = useState("")
  const [companyId, setCompanyId] = useState("") 
  const [grossAmount, setGrossAmount] = useState("")
  const [method, setMethod] = useState<PaymentMethod | "">("")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0])

  // Tickets & Allocations State
  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [allocations, setAllocations] = useState<Record<string, string>>({})

  const handleClientChange = async (selectedClientId: string | null) => {
    const validId = selectedClientId ?? ""
    setClientId(validId)
    if (!validId) {
      setTickets([])
      setAllocations({})
      return
    }

    setIsLoadingTickets(true)
    try {
      const data = await getClientTicketsAction(validId)
      setCompanyId(data.companyId)
      setTickets(data.tickets)
      
      // Auto-allocate logic could be added here, but starting empty:
      setAllocations({})
      
    } catch (e) {
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

  const handleAllocationChange = (ticketId: string, val: string) => {
    setAllocations(prev => ({
      ...prev,
      [ticketId]: parseCurrencyInput(val)
    }))
  }

  // Derived totals
  const totalAllocated = Object.values(allocations).reduce((acc, curr) => {
    const parsed = parseFloat(curr)
    return acc + (isNaN(parsed) ? 0 : parsed)
  }, 0)

  const parsedGrossAmt = parseFloat(grossAmount)
  const isGrossAmtValid = !isNaN(parsedGrossAmt) && parsedGrossAmt > 0
  const isOverAllocated = isGrossAmtValid && totalAllocated > parsedGrossAmt
  
  // Calculate remaining unallocated from the gross amount
  const remainingToAllocate = isGrossAmtValid ? Math.max(0, parsedGrossAmt - totalAllocated) : 0

  const onSubmit = () => {
    if (!clientId) return toast.error("Seleccione un cliente")
    if (!isGrossAmtValid) return toast.error("El monto total es requerido y debe ser > 0")
    if (!method) return toast.error("Seleccione un método de pago")
    if (!paymentDate) return toast.error("Seleccione una fecha")
    
    // Check total allocation balance
    // allow under-allocated? Sometimes they don't apply the full payment to tickets immediately? 
    // Wait, the prompt says "total amount allocated across tickets <= payment gross amount". It doesn't strictly say it MUST equal it.
    if (isOverAllocated) return toast.error("El monto asignado supera al monto del cobro")

    const finalAllocations = Object.entries(allocations)
      .map(([id, amt]) => ({ ticketId: id, allocatedAmount: amt }))
      .filter(a => {
        const p = parseFloat(a.allocatedAmount)
        return !isNaN(p) && p > 0
      })
      
    if (finalAllocations.length === 0) {
       // Wait, do they have to allocate *something*? 
       // Often a payment can just be a credit on account if there's no allocations, but for now we'll allow 0 allocations or warn
    }

    startTransition(async () => {
      const res = await createPaymentAction({
        companyId,
        clientId,
        grossAmount: parsedGrossAmt.toString(),
        method: method as PaymentMethod,
        paymentDate: new Date(paymentDate), // standard parsing
        reference: reference || undefined,
        notes: notes || undefined,
        allocations: finalAllocations
      })

      if (!res.success) {
        toast.error(res.error)
      } else {
        toast.success("Pago registrado correctamente")
        router.push("/payments")
      }
    })
  }

  const [clientSearch, setClientSearch] = useState("")
  
  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalles del Pago</CardTitle>
        <CardDescription>Cargue los datos del pago y asigne montos a los tickets correspondientes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Cliente / Empresa</Label>
            <Input 
              placeholder="Filtrar por nombre..." 
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="mb-1"
            />
            <Select value={clientId} onValueChange={handleClientChange}>
              <SelectTrigger className="h-auto whitespace-normal text-left">
                <SelectValue placeholder="Seleccione un cliente..." />
              </SelectTrigger>
              <SelectContent>
                {filteredClients.map(c => (
                  <SelectItem key={c.id} value={c.id} className="whitespace-normal">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Monto Total Recibido (Gross)</Label>
            <Input 
              type="text" 
              placeholder="0.00" 
              value={formatInputCurrency(grossAmount)}
              onChange={(e) => setGrossAmount(parseCurrencyInput(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label>Método de Pago</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BANK_TRANSFER">Transferencia</SelectItem>
                <SelectItem value="CHECK">Cheque</SelectItem>
                <SelectItem value="CASH">Efectivo</SelectItem>
                <SelectItem value="CREDIT_CARD">Tarjeta</SelectItem>
                <SelectItem value="OTHER">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fecha de Pago</Label>
            <Input 
              type="date" 
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Referencia (Opcional)</Label>
            <Input 
              placeholder="# Cheque o Tx" 
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Notas (Opcional)</Label>
            <Textarea 
              placeholder="Observaciones..." 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Tickets Allocation Table */}
        {clientId && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Asignar a Tickets</h3>
              <div className="text-sm">
                Recibido: <span className="font-semibold">{formatMoney(parsedGrossAmt || 0, "USD")}</span>
                 {" | "}
                Asignado: <span className={`font-semibold ${isOverAllocated ? 'text-destructive' : ''}`}>{formatMoney(totalAllocated, "USD")}</span>
                 {" | "}
                Restante: <span className="font-semibold">{formatMoney(remainingToAllocate, "USD")}</span>
              </div>
            </div>

            {isLoadingTickets ? (
              <p className="text-sm text-muted-foreground">Cargando tickets...</p>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">El cliente no tiene tickets pendientes.</p>
            ) : (
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">Ticket / Item</th>
                      <th className="p-3 text-right font-medium">Original</th>
                      <th className="p-3 text-right font-medium">Pagado</th>
                      <th className="p-3 text-right font-medium">Restante</th>
                      <th className="p-3 text-right font-medium">Asignar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map(t => {
                      const amount = parseFloat(t.amount.toString())
                      const paid = parseFloat(t.paidAmount.toString())
                      const remaining = amount - paid
                      
                      return (
                        <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="p-3">
                            <div className="font-medium">{t.ticketNumber}</div>
                            <div className="text-xs text-muted-foreground">{t.contractItem.name}</div>
                            <div className="text-xs text-muted-foreground">Vcto: {format(new Date(t.dueDate), "dd MMM yyyy", { locale: es })}</div>
                          </td>
                          <td className="p-3 text-right">{formatMoney(amount, t.currency)}</td>
                          <td className="p-3 text-right">{formatMoney(paid, t.currency)}</td>
                          <td className="p-3 text-right font-medium">{formatMoney(remaining, t.currency)}</td>
                          <td className="p-3 text-right">
                            <Input 
                              type="text" 
                              className="w-28 ml-auto text-right"
                              placeholder="0.00"
                              value={formatInputCurrency(allocations[t.id] ?? "")}
                              onChange={(e) => handleAllocationChange(t.id, e.target.value)}
                            />
                            <div className="mt-1 flex justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-5 px-1.5 text-[10px]"
                                onClick={() => {
                                  // Asignar el total restante del ticket (o lo que quede del grossAmount)
                                  if (remainingToAllocate > 0) {
                                     const toAssign = Math.min(remaining, remainingToAllocate)
                                     handleAllocationChange(t.id, toAssign.toFixed(2))
                                  } else {
                                     handleAllocationChange(t.id, remaining.toFixed(2))
                                  }
                                }}
                              >
                                Max
                              </Button>
                            </div>
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
      </CardContent>
      <CardFooter className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push("/payments")} disabled={isPending}>
          Cancelar
        </Button>
        <Button onClick={onSubmit} disabled={isPending || isOverAllocated || !isGrossAmtValid || !clientId}>
          {isPending ? "Registrando..." : "Registrar Pago"}
        </Button>
      </CardFooter>
    </Card>
  )
}
