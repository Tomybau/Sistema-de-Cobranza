"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Lock } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { contractSchema, type ContractFormValues } from "@/domain/contracts/schemas"
import { CURRENCIES } from "@/lib/currencies"
import type { ActionResult } from "@/app/(dashboard)/contracts/actions"
import type { ContractDetail } from "@/domain/contracts/queries"

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  ENDED: "Finalizado",
  CANCELLED: "Cancelado",
}

interface ContractFormProps {
  defaultValues?: ContractDetail
  companies?: { id: string; legalName: string }[]
  preselectedCompanyId?: string
  action: (data: ContractFormValues) => Promise<ActionResult>
  submitLabel?: string
}

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return ""
  return new Date(date).toISOString().split("T")[0]
}

export function ContractForm({
  defaultValues,
  companies,
  preselectedCompanyId,
  action,
  submitLabel = "Guardar",
}: ContractFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isActive = defaultValues?.status === "ACTIVE"

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      companyId: defaultValues?.companyId ?? preselectedCompanyId ?? "",
      contractNumber: defaultValues?.contractNumber ?? suggestContractNumber(),
      title: defaultValues?.title ?? "",
      description: defaultValues?.description ?? "",
      currency: (defaultValues?.currency ?? "USD") as ContractFormValues["currency"],
      startDate: toDateInputValue(defaultValues?.startDate),
      endDate: toDateInputValue(defaultValues?.endDate),
      status: (defaultValues?.status ?? "DRAFT") as ContractFormValues["status"],
      paymentTermsDays: defaultValues?.paymentTermsDays ?? 15,
      lateFeePercent: defaultValues?.lateFeePercent != null
        ? Number(defaultValues.lateFeePercent.toString())
        : 0,
      notes: defaultValues?.notes ?? "",
    },
  })

  const watchedCurrency = watch("currency")
  const watchedStatus = watch("status")

  function onSubmit(values: ContractFormValues) {
    setServerError(null)
    startTransition(async () => {
      const result = await action(values)
      if (!result.success) {
        setServerError(result.error)
        toast.error(result.error)
      }
      // Si success: la acción redirige
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Empresa */}
      {companies && companies.length > 0 && (
        <section className="space-y-2">
          <Label htmlFor="companyId">
            Empresa <span className="text-destructive">*</span>
          </Label>
          <Select
            defaultValue={defaultValues?.companyId ?? preselectedCompanyId ?? ""}
            onValueChange={(v) => v != null && setValue("companyId", v)}
            disabled={isPending || !!defaultValues}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccioná una empresa" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id} label={c.legalName}>
                  {c.legalName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.companyId && (
            <p className="text-sm text-destructive">{errors.companyId.message}</p>
          )}
        </section>
      )}

      {/* Identificación */}
      <section className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Identificación
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contractNumber">
              Número de contrato <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contractNumber"
              disabled={isPending}
              {...register("contractNumber")}
              aria-invalid={!!errors.contractNumber}
            />
            {errors.contractNumber && (
              <p className="text-sm text-destructive">
                {errors.contractNumber.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Estado</Label>
            <Select
              defaultValue={defaultValues?.status ?? "DRAFT"}
              onValueChange={(v) =>
                v != null && setValue("status", v as ContractFormValues["status"])
              }
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val} label={label}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="title">
              Título <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              placeholder="Ej: Servicio de soporte mensual 2026"
              disabled={isPending}
              {...register("title")}
              aria-invalid={!!errors.title}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              placeholder="Descripción del alcance del contrato..."
              rows={2}
              disabled={isPending}
              {...register("description")}
            />
          </div>
        </div>
      </section>

      {/* Condiciones */}
      <section className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Condiciones
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="currency">
              Moneda <span className="text-destructive">*</span>
              {isActive && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" /> Bloqueado (contrato activo)
                </span>
              )}
            </Label>
            <Select
              defaultValue={defaultValues?.currency ?? "USD"}
              onValueChange={(v) => v != null && setValue("currency", v as ContractFormValues["currency"])}
              disabled={isPending || isActive}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c} label={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.currency && (
              <p className="text-sm text-destructive">{errors.currency.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">
              Fecha de inicio <span className="text-destructive">*</span>
              {isActive && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" /> Bloqueado
                </span>
              )}
            </Label>
            <Input
              id="startDate"
              type="date"
              disabled={isPending || isActive}
              {...register("startDate")}
              aria-invalid={!!errors.startDate}
            />
            {errors.startDate && (
              <p className="text-sm text-destructive">{errors.startDate.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">Fecha de fin (opcional)</Label>
            <Input
              id="endDate"
              type="date"
              disabled={isPending}
              {...register("endDate")}
              aria-invalid={!!errors.endDate}
            />
            {errors.endDate && (
              <p className="text-sm text-destructive">{errors.endDate.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentTermsDays">Días para vencimiento</Label>
            <Input
              id="paymentTermsDays"
              type="number"
              min={0}
              max={90}
              disabled={isPending}
              {...register("paymentTermsDays", { valueAsNumber: true })}
              aria-invalid={!!errors.paymentTermsDays}
            />
            {errors.paymentTermsDays && (
              <p className="text-sm text-destructive">
                {errors.paymentTermsDays.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lateFeePercent">% Mora</Label>
            <Input
              id="lateFeePercent"
              type="number"
              min={0}
              max={100}
              step="0.01"
              disabled={isPending}
              {...register("lateFeePercent", { valueAsNumber: true })}
              aria-invalid={!!errors.lateFeePercent}
            />
            {errors.lateFeePercent && (
              <p className="text-sm text-destructive">
                {errors.lateFeePercent.message}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Notas */}
      <section className="space-y-2">
        <Label htmlFor="notes">Notas internas</Label>
        <Textarea
          id="notes"
          placeholder="Observaciones internas sobre este contrato..."
          rows={3}
          disabled={isPending}
          {...register("notes")}
        />
      </section>

      {serverError && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => history.back()}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}

function suggestContractNumber(): string {
  const year = new Date().getFullYear()
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `CTR-${year}-${rand}`
}
