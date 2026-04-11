"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { clientSchema, type ClientFormValues } from "@/domain/clients/schemas"
import type { ActionResult } from "@/app/(dashboard)/companies/actions"
import type { Client } from "@prisma/client"

interface ClientFormProps {
  defaultValues?: Partial<Client>
  action: (formData: FormData) => Promise<ActionResult>
  submitLabel?: string
}

export function ClientForm({
  defaultValues,
  action,
  submitLabel = "Guardar",
}: ClientFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      fullName: defaultValues?.fullName ?? "",
      role: defaultValues?.role ?? "",
      email: defaultValues?.email ?? "",
      phone: defaultValues?.phone ?? "",
      isPrimary: defaultValues?.isPrimary === true,
    },
  })

  function onSubmit(values: ClientFormValues) {
    setServerError(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set("fullName", values.fullName)
      if (values.role) formData.set("role", values.role)
      formData.set("email", values.email)
      if (values.phone) formData.set("phone", values.phone)
      if (values.isPrimary) formData.set("isPrimary", "on")

      const result = await action(formData)
      if (!result.success) {
        setServerError(result.error)
        toast.error(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">
            Nombre completo <span className="text-destructive">*</span>
          </Label>
          <Input
            id="fullName"
            placeholder="Carlos Rodríguez"
            disabled={isPending}
            {...register("fullName")}
            aria-invalid={!!errors.fullName}
          />
          {errors.fullName && (
            <p className="text-sm text-destructive">{errors.fullName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Rol</Label>
          <Input
            id="role"
            placeholder="Owner, Contador, etc."
            disabled={isPending}
            {...register("role")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="contacto@empresa.com"
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
            placeholder="+54 11 9000-1234"
            disabled={isPending}
            {...register("phone")}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="isPrimary"
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          disabled={isPending}
          {...register("isPrimary")}
        />
        <Label htmlFor="isPrimary" className="cursor-pointer">
          Contacto principal de la empresa
        </Label>
      </div>

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
