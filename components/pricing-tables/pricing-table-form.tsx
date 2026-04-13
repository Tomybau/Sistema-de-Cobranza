"use client"

import { useState, useTransition } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  pricingTableSchema,
  type PricingTableFormValues,
} from "@/domain/pricing_tables/schemas"
import type { ActionResult } from "@/app/(dashboard)/pricing-tables/actions"
import type { PricingTableDetail } from "@/domain/pricing_tables/queries"

interface PricingTableFormProps {
  defaultValues?: PricingTableDetail
  action: (data: PricingTableFormValues) => Promise<ActionResult>
  submitLabel?: string
}

export function PricingTableForm({
  defaultValues,
  action,
  submitLabel = "Guardar",
}: PricingTableFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PricingTableFormValues>({
    resolver: zodResolver(pricingTableSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      description: defaultValues?.description ?? "",
      tiers:
        defaultValues?.tiers.map((t) => ({
          id: t.id,
          fromQuantity: t.fromQuantity.toString(),
          toQuantity: t.toQuantity?.toString() ?? "",
          unitPrice: t.unitPrice.toString(),
          flatFee: t.flatFee?.toString() ?? "",
        })) ?? [
          { fromQuantity: "0", toQuantity: "", unitPrice: "0", flatFee: "" },
        ],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "tiers",
  })

  function onSubmit(values: PricingTableFormValues) {
    setServerError(null)
    startTransition(async () => {
      const result = await action(values)
      if (!result.success) {
        setServerError(result.error)
        toast.error(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Datos básicos */}
      <section className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">
            Nombre <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder="Ej: Tabla SaaS básico"
            disabled={isPending}
            {...register("name")}
            aria-invalid={!!errors.name}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Descripción</Label>
          <Textarea
            id="description"
            placeholder="Descripción opcional..."
            rows={2}
            disabled={isPending}
            {...register("description")}
          />
        </div>
      </section>

      {/* Tiers */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">
            Rangos de precios <span className="text-destructive">*</span>
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() =>
              append({ fromQuantity: "", toQuantity: "", unitPrice: "", flatFee: "" })
            }
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Agregar rango
          </Button>
        </div>

        {typeof errors.tiers?.message === "string" && (
          <p className="text-sm text-destructive">{errors.tiers.message}</p>
        )}

        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr_2.5rem] gap-2 text-xs font-medium text-muted-foreground px-1">
            <span>Desde (qty)</span>
            <span>Hasta (qty)</span>
            <span>Precio unitario</span>
            <span>Fee fijo (opt.)</span>
            <span />
          </div>

          {fields.map((field, idx) => (
            <div
              key={field.id}
              className="grid grid-cols-[1fr_1fr_1fr_1fr_2.5rem] gap-2 items-start"
            >
              <div>
                <Input
                  placeholder="0"
                  disabled={isPending}
                  {...register(`tiers.${idx}.fromQuantity`)}
                  aria-invalid={!!errors.tiers?.[idx]?.fromQuantity}
                />
                {errors.tiers?.[idx]?.fromQuantity && (
                  <p className="text-xs text-destructive mt-0.5">
                    {errors.tiers[idx].fromQuantity?.message}
                  </p>
                )}
              </div>
              <div>
                <Input
                  placeholder="Sin límite"
                  disabled={isPending}
                  {...register(`tiers.${idx}.toQuantity`)}
                  aria-invalid={!!errors.tiers?.[idx]?.toQuantity}
                />
                {errors.tiers?.[idx]?.toQuantity && (
                  <p className="text-xs text-destructive mt-0.5">
                    {errors.tiers[idx].toQuantity?.message}
                  </p>
                )}
              </div>
              <div>
                <Input
                  placeholder="0.00"
                  disabled={isPending}
                  {...register(`tiers.${idx}.unitPrice`)}
                  aria-invalid={!!errors.tiers?.[idx]?.unitPrice}
                />
                {errors.tiers?.[idx]?.unitPrice && (
                  <p className="text-xs text-destructive mt-0.5">
                    {errors.tiers[idx].unitPrice?.message}
                  </p>
                )}
              </div>
              <div>
                <Input
                  placeholder="0.00"
                  disabled={isPending}
                  {...register(`tiers.${idx}.flatFee`)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={isPending || fields.length === 1}
                onClick={() => remove(idx)}
                className="shrink-0"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
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
