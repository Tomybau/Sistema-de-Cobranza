"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import type { RecentPaymentData } from "../_data/get-recent-payments"
import { PaymentMethod } from "@prisma/client"
import { CreditCard, Banknote, LandPlot, Building, HelpCircle } from "lucide-react"

interface RecentPaymentsProps {
  data: RecentPaymentData[]
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Transferencia",
  CHECK: "Cheque",
  CASH: "Efectivo",
  CREDIT_CARD: "Tarjeta",
  OTHER: "Otro",
}

const METHOD_ICONS: Record<PaymentMethod, any> = {
  BANK_TRANSFER: Building,
  CHECK: LandPlot,
  CASH: Banknote,
  CREDIT_CARD: CreditCard,
  OTHER: HelpCircle,
}

export function RecentPayments({ data }: RecentPaymentsProps) {
  return (
    <Card className="col-span-full lg:col-span-3">
      <CardHeader>
        <CardTitle>Últimos Pagos</CardTitle>
        <CardDescription>Pagos procesados recientemente</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground text-sm border border-dashed rounded-lg">
            No hay pagos recientes
          </div>
        ) : (
          <div className="space-y-6">
            {data.map((payment) => {
              const Icon = METHOD_ICONS[payment.method]
              return (
                <div key={payment.id} className="flex items-center justify-between group">
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {payment.clientInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <Link href={`/payments/${payment.id}`} className="text-sm font-medium leading-none hover:underline">
                        {payment.clientName}
                      </Link>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Icon className="mr-1 h-3 w-3" />
                        {METHOD_LABELS[payment.method]}
                        <span className="mx-1">•</span>
                        {formatDistanceToNow(new Date(payment.date), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="font-medium text-emerald-600 dark:text-emerald-400">
                    +{new Intl.NumberFormat("es-AR", {
                      style: "currency",
                      currency: "ARS",
                    }).format(payment.amount)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
