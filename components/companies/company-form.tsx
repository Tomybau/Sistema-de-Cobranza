"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { companySchema, type CompanyFormValues } from "@/domain/companies/schemas"
import type { ActionResult } from "@/app/(dashboard)/companies/actions"
import type { Company } from "@prisma/client"

interface CompanyFormProps {
  defaultValues?: Partial<Company>
  action: (formData: FormData) => Promise<ActionResult>
  submitLabel?: string
}

export function CompanyForm({
  defaultValues,
  action,
  submitLabel = "Guardar",
}: CompanyFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      legalName: defaultValues?.legalName ?? "",
      tradeName: defaultValues?.tradeName ?? "",
      taxId: defaultValues?.taxId ?? "",
      email: defaultValues?.email ?? "",
      phone: defaultValues?.phone ?? "",
      address: defaultValues?.address ?? "",
      city: defaultValues?.city ?? "",
      country: defaultValues?.country ?? "",
      notes: defaultValues?.notes ?? "",
    },
  })

  function onSubmit(values: CompanyFormValues) {
    setServerError(null)
    startTransition(async () => {
      const formData = new FormData()
      Object.entries(values).forEach(([k, v]) => {
        if (v !== undefined && v !== null) formData.set(k, String(v))
      })
      const result = await action(formData)
      if (!result.success) {
        setServerError(result.error)
        toast.error(result.error)
      }
      // Si success: la acción redirige
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Sección: Datos legales */}
      <section className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Datos legales
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="legalName">
              Razón social <span className="text-destructive">*</span>
            </Label>
            <Input
              id="legalName"
              placeholder="Tecnologías del Sur S.A."
              disabled={isPending}
              {...register("legalName")}
              aria-invalid={!!errors.legalName}
            />
            {errors.legalName && (
              <p className="text-sm text-destructive">{errors.legalName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="tradeName">Nombre comercial</Label>
            <Input
              id="tradeName"
              placeholder="TecSur"
              disabled={isPending}
              {...register("tradeName")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxId">CUIT / Tax ID</Label>
            <Input
              id="taxId"
              placeholder="30-12345678-9"
              disabled={isPending}
              {...register("taxId")}
              aria-invalid={!!errors.taxId}
            />
            {errors.taxId && (
              <p className="text-sm text-destructive">{errors.taxId.message}</p>
            )}
          </div>
        </div>
      </section>

      {/* Sección: Contacto */}
      <section className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Contacto
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@empresa.com"
              disabled={isPending}
              {...register("email")}
              aria-invalid={!!errors.email}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              placeholder="+54 11 4000-1234"
              disabled={isPending}
              {...register("phone")}
            />
          </div>
        </div>
      </section>

      {/* Sección: Dirección */}
      <section className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Dirección
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="address">Dirección</Label>
            <Input
              id="address"
              placeholder="Av. Corrientes 1234"
              disabled={isPending}
              {...register("address")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Ciudad</Label>
            <Input
              id="city"
              placeholder="Buenos Aires"
              disabled={isPending}
              {...register("city")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">País</Label>
            <Input
              id="country"
              placeholder="Argentina"
              disabled={isPending}
              {...register("country")}
            />
          </div>
        </div>
      </section>

      {/* Notas */}
      <section className="space-y-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea
          id="notes"
          placeholder="Notas internas sobre esta empresa..."
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
        <Button type="button" variant="outline" disabled={isPending} onClick={() => history.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
