"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { OverdueTicketData } from "../_data/get-overdue-tickets"
import { Badge } from "@/components/ui/badge"

interface OverdueTableProps {
  data: OverdueTicketData[]
}

export function OverdueTable({ data }: OverdueTableProps) {
  return (
    <Card className="col-span-full lg:col-span-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Tickets Vencidos</CardTitle>
          <CardDescription>Principales tickets pendientes de pago</CardDescription>
        </div>
        {data.length >= 10 && (
          <Link
            href="/tickets?status=OVERDUE"
            className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
          >
            Ver todos
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground text-sm border border-dashed rounded-lg">
            No hay tickets vencidos actualmente
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Empresa / Cliente</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell>
                    <Link
                      href={`/tickets/${ticket.id}`}
                      className="font-medium hover:underline text-primary"
                    >
                      {ticket.ticketNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{ticket.companyName}</div>
                    <div className="text-xs text-muted-foreground">{ticket.clientName}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{format(new Date(ticket.dueDate), "dd MMM yyyy", { locale: es })}</div>
                    <Badge variant="destructive" className="mt-1 text-[10px] px-1 py-0 h-4">
                      hace {ticket.daysOverdue} {ticket.daysOverdue === 1 ? "día" : "días"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium text-destructive">
                    {new Intl.NumberFormat("es-AR", {
                      style: "currency",
                      currency: "ARS",
                    }).format(ticket.totalAmount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
