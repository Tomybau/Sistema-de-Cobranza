"use client"

import { useState, useTransition, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Lock, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DraftItemsSection } from "@/components/contracts/draft-items-section"
import { contractSchema, type ContractFormValues } from "@/domain/contracts/schemas"
import { CURRENCIES } from "@/lib/currencies"
import { ocrResultToDraftItems } from "@/lib/ocr-to-draft-items"
import type {
  ActionResult,
  CreateContractFullInput,
  NewCompanyInput,
  NewClientInput,
  DraftItemInput,
} from "@/app/(dashboard)/contracts/types"
import type { ContractDetail } from "@/domain/contracts/queries"
import type { OcrContractResult } from "@/domain/ocr/schemas"
import type { ClientMatchResult } from "@/domain/ocr/match-client"
import { cn } from "@/lib/utils"

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  ENDED: "Finalizado",
  CANCELLED: "Cancelado",
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ContractFormProps {
  defaultValues?: ContractDetail
  companies?: { id: string; legalName: string }[]
  preselectedCompanyId?: string
  // Edit mode
  action?: (data: ContractFormValues) => Promise<ActionResult>
  // Create mode (empresa+cliente+items inline)
  createFullAction?: (input: CreateContractFullInput) => Promise<ActionResult>
  submitLabel?: string
  // OCR pre-fill
  ocrData?: OcrContractResult | null
  ocrMatch?: ClientMatchResult | null
  ocrDocumentId?: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return ""
  return new Date(date).toISOString().split("T")[0]
}

function suggestContractNumber(): string {
  const year = new Date().getFullYear()
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `CTR-${year}-${rand}`
}

const EMPTY_COMPANY: NewCompanyInput = {
  legalName: "",
  taxId: "",
  email: "",
  phone: "",
  address: "",
}

const EMPTY_CLIENT: NewClientInput = {
  fullName: "",
  email: "",
  phone: "",
  role: "",
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ContractForm({
  defaultValues,
  companies,
  preselectedCompanyId,
  action,
  createFullAction,
  submitLabel = "Guardar",
  ocrData,
  ocrMatch,
  ocrDocumentId,
}: ContractFormProps) {
  const isCreateMode = !defaultValues && !!createFullAction

  // --- RHF for contract fields ---
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
      lateFeePercent:
        defaultValues?.lateFeePercent != null
          ? Number(defaultValues.lateFeePercent.toString())
          : 0,
      notes: defaultValues?.notes ?? "",
    },
  })

  const watchedStatus = watch("status")
  const watchedCompanyId = watch("companyId")
  const isActive = defaultValues?.status === "ACTIVE"

  // --- Create-mode state ---
  const [companyMode, setCompanyMode] = useState<"existing" | "new">("existing")
  const [newCompany, setNewCompany] = useState<NewCompanyInput>({ ...EMPTY_COMPANY })
  const [newClient, setNewClient] = useState<NewClientInput>({ ...EMPTY_CLIENT })
  const [draftItems, setDraftItems] = useState<DraftItemInput[]>([])

  // --- OCR highlight tracking ---
  const [ocrFields, setOcrFields] = useState<Set<string>>(new Set())

  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Pre-fill contract fields from OCR
  useEffect(() => {
    if (!ocrData) return

    const filled = new Set<string>()
    const c = ocrData.contract

    if (c.name) { setValue("title", c.name); filled.add("title") }
    if (c.startDate) { setValue("startDate", c.startDate); filled.add("startDate") }
    if (c.endDate) { setValue("endDate", c.endDate); filled.add("endDate") }
    if (c.currency) {
      setValue("currency", c.currency as ContractFormValues["currency"])
      filled.add("currency")
    }
    if (c.lateFeePct != null) { setValue("lateFeePercent", c.lateFeePct); filled.add("lateFeePercent") }
    if (c.paymentTermsDays != null) { setValue("paymentTermsDays", c.paymentTermsDays); filled.add("paymentTermsDays") }
    if (c.notes) { setValue("notes", c.notes); filled.add("notes") }

    // Pre-select existing company if match found
    if (ocrMatch?.company?.id) {
      setValue("companyId", ocrMatch.company.id)
      filled.add("companyId")
    }

    setOcrFields((prev) => new Set([...prev, ...filled]))
    if (filled.size > 0) toast.success(`${filled.size} campo(s) del contrato pre-cargados`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocrData])

  // Pre-fill company/client fields from OCR (only in create mode with "new" company)
  useEffect(() => {
    if (!ocrData || !isCreateMode) return

    const cl = ocrData.client
    const filled = new Set<string>()

    if (cl.name) {
      setNewCompany((p) => ({ ...p, legalName: cl.name }))
      setNewClient((p) => ({ ...p, fullName: cl.name }))
      filled.add("company.name")
      filled.add("client.name")
    }
    if (cl.taxId) {
      setNewCompany((p) => ({ ...p, taxId: cl.taxId! }))
      filled.add("company.taxId")
    }
    if (cl.email) {
      setNewCompany((p) => ({ ...p, email: cl.email! }))
      setNewClient((p) => ({ ...p, email: cl.email! }))
      filled.add("company.email")
      filled.add("client.email")
    }
    if (cl.phone) {
      setNewCompany((p) => ({ ...p, phone: cl.phone! }))
      filled.add("company.phone")
    }
    if (cl.address) {
      setNewCompany((p) => ({ ...p, address: cl.address! }))
      filled.add("company.address")
    }

    setOcrFields((prev) => new Set([...prev, ...filled]))
    if (filled.size > 0) toast.success(`Datos del cliente pre-cargados desde el documento`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocrData])

  // Pre-fill ítems del contrato desde OCR (solo en create mode)
  useEffect(() => {
    if (!ocrData || !isCreateMode) return
    const drafted = ocrResultToDraftItems(ocrData)
    if (drafted.length === 0) return
    setDraftItems((prev) => (prev.length === 0 ? drafted : prev))
    toast.success(`${drafted.length} ítem(s) pre-cargados desde el contrato`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocrData])

  function ocrClass(field: string) {
    return ocrFields.has(field) ? "ring-2 ring-yellow-400/60 ring-offset-1" : ""
  }

  function handleCompanyModeChange(mode: "existing" | "new") {
    setCompanyMode(mode)
    // When switching to "new", set sentinel so RHF companyId validation passes
    if (mode === "new") setValue("companyId", "__new__")
    else setValue("companyId", preselectedCompanyId ?? "")
  }

  function onSubmit(values: ContractFormValues) {
    setServerError(null)

    if (isCreateMode) {
      // Extra client-side validation for create mode
      if (companyMode === "existing" && !values.companyId) {
        setServerError("Seleccioná una empresa")
        return
      }
      if (companyMode === "new" && !newCompany.legalName.trim()) {
        setServerError("La razón social es obligatoria")
        return
      }
      if (companyMode === "new" && !newClient.email.trim()) {
        setServerError("El email del contacto es obligatorio")
        return
      }

      startTransition(async () => {
        const result = await createFullAction!({
          contract: values,
          companyMode,
          newCompany: companyMode === "new" ? newCompany : undefined,
          newClient: companyMode === "new" ? newClient : undefined,
          items: draftItems,
          ocrDocumentId,
        })
        if (!result.success) {
          setServerError(result.error)
          toast.error(result.error)
        }
      })
      return
    }

    // Edit mode
    startTransition(async () => {
      const result = await action!(values)
      if (!result.success) {
        setServerError(result.error)
        toast.error(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* OCR banner */}
      {ocrData && (
        <div className="rounded-md border border-yellow-400/40 bg-yellow-50/50 px-4 py-3 text-sm dark:bg-yellow-900/10">
          <div className="flex items-center gap-2 mb-1 font-medium">
            <Sparkles className="h-4 w-4 text-yellow-600" />
            Datos extraídos automáticamente — revisá y corregí si es necesario
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-xs flex-wrap">
            Confianza OCR:
            <Badge variant={ocrData.confidence === "HIGH" ? "default" : "outline"} className="text-xs">
              {ocrData.confidence}
            </Badge>
            {ocrMatch && (
              <>
                · Cliente detectado:
                <Badge
                  variant={
                    ocrMatch.confidence === "EXACT"
                      ? "default"
                      : ocrMatch.confidence === "FUZZY"
                      ? "secondary"
                      : "outline"
                  }
                  className="text-xs"
                >
                  {ocrMatch.confidence === "EXACT"
                    ? "✓ Encontrado"
                    : ocrMatch.confidence === "FUZZY"
                    ? "⚠ Posible match"
                    : "No encontrado"}
                </Badge>
                {ocrMatch.company && <span>({ocrMatch.company.legalName})</span>}
              </>
            )}
          </div>
          {ocrData.items.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {ocrData.items.length} ítem(s) detectado(s) — podés agregarlos abajo.
            </p>
          )}
        </div>
      )}

      {/* ── Empresa (create mode) ── */}
      {isCreateMode && (
        <section className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Empresa
          </h3>

          {/* Mode toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={companyMode === "existing" ? "default" : "outline"}
              onClick={() => handleCompanyModeChange("existing")}
            >
              Empresa existente
            </Button>
            <Button
              type="button"
              size="sm"
              variant={companyMode === "new" ? "default" : "outline"}
              onClick={() => handleCompanyModeChange("new")}
            >
              Nueva empresa
            </Button>
          </div>

          {companyMode === "existing" ? (
            /* Company dropdown */
            <div className="space-y-2">
              <Label htmlFor="companyId">
                Empresa <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watchedCompanyId}
                onValueChange={(v) => v != null && setValue("companyId", v)}
                disabled={isPending}
              >
                <SelectTrigger className={cn(ocrClass("companyId"))}>
                  <SelectValue placeholder="Seleccioná una empresa">
                    {watchedCompanyId
                      ? (companies ?? []).find((c) => c.id === watchedCompanyId)?.legalName
                      : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(companies ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id} label={c.legalName}>
                      {c.legalName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.companyId && companyMode === "existing" && (
                <p className="text-sm text-destructive">{errors.companyId.message}</p>
              )}
            </div>
          ) : (
            /* New company + client fields */
            <div className="rounded-md border p-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>
                    Razón social <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={newCompany.legalName}
                    onChange={(e) => setNewCompany((p) => ({ ...p, legalName: e.target.value }))}
                    placeholder="Ej: Acme S.A."
                    className={cn(ocrClass("company.name"))}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CUIT / RUT</Label>
                  <Input
                    value={newCompany.taxId ?? ""}
                    onChange={(e) => setNewCompany((p) => ({ ...p, taxId: e.target.value }))}
                    placeholder="30-12345678-9"
                    className={cn(ocrClass("company.taxId"))}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email empresa</Label>
                  <Input
                    type="email"
                    value={newCompany.email ?? ""}
                    onChange={(e) => setNewCompany((p) => ({ ...p, email: e.target.value }))}
                    placeholder="info@empresa.com"
                    className={cn(ocrClass("company.email"))}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input
                    value={newCompany.phone ?? ""}
                    onChange={(e) => setNewCompany((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="+54 11 1234-5678"
                    className={cn(ocrClass("company.phone"))}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dirección</Label>
                  <Input
                    value={newCompany.address ?? ""}
                    onChange={(e) => setNewCompany((p) => ({ ...p, address: e.target.value }))}
                    placeholder="Av. Corrientes 1234, CABA"
                    className={cn(ocrClass("company.address"))}
                    disabled={isPending}
                  />
                </div>
              </div>

              {/* Contacto principal */}
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Contacto principal</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>
                      Nombre completo <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={newClient.fullName}
                      onChange={(e) => setNewClient((p) => ({ ...p, fullName: e.target.value }))}
                      placeholder="Juan Pérez"
                      className={cn(ocrClass("client.name"))}
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="email"
                      value={newClient.email}
                      onChange={(e) => setNewClient((p) => ({ ...p, email: e.target.value }))}
                      placeholder="juan@empresa.com"
                      className={cn(ocrClass("client.email"))}
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input
                      value={newClient.phone ?? ""}
                      onChange={(e) => setNewClient((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="+54 11 1234-5678"
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rol / Cargo</Label>
                    <Input
                      value={newClient.role ?? ""}
                      onChange={(e) => setNewClient((p) => ({ ...p, role: e.target.value }))}
                      placeholder="Ej: Gerente, Contador..."
                      disabled={isPending}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Empresa (edit mode) — dropdown clásico ── */}
      {!isCreateMode && companies && companies.length > 0 && (
        <section className="space-y-2">
          <Label htmlFor="companyId">
            Empresa <span className="text-destructive">*</span>
          </Label>
          <Select
            value={watchedCompanyId}
            onValueChange={(v) => v != null && setValue("companyId", v)}
            disabled={isPending || !!defaultValues}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccioná una empresa">
                {watchedCompanyId
                  ? companies.find((c) => c.id === watchedCompanyId)?.legalName
                  : undefined}
              </SelectValue>
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

      {/* ── Identificación ── */}
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
              className={cn(ocrClass("contractNumber"))}
              {...register("contractNumber")}
              aria-invalid={!!errors.contractNumber}
            />
            {errors.contractNumber && (
              <p className="text-sm text-destructive">{errors.contractNumber.message}</p>
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
              className={cn(ocrClass("title"))}
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

      {/* ── Condiciones ── */}
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
                  <Lock className="h-3 w-3" /> Bloqueado
                </span>
              )}
            </Label>
            <Select
              defaultValue={defaultValues?.currency ?? "USD"}
              onValueChange={(v) =>
                v != null && setValue("currency", v as ContractFormValues["currency"])
              }
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
              className={cn(ocrClass("startDate"))}
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
              className={cn(ocrClass("endDate"))}
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
              <p className="text-sm text-destructive">{errors.paymentTermsDays.message}</p>
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
              className={cn(ocrClass("lateFeePercent"))}
              {...register("lateFeePercent", { valueAsNumber: true })}
              aria-invalid={!!errors.lateFeePercent}
            />
            {errors.lateFeePercent && (
              <p className="text-sm text-destructive">{errors.lateFeePercent.message}</p>
            )}
          </div>
        </div>
      </section>

      {/* ── Notas ── */}
      <section className="space-y-2">
        <Label htmlFor="notes">Notas internas</Label>
        <Textarea
          id="notes"
          placeholder="Observaciones internas sobre este contrato..."
          rows={3}
          disabled={isPending}
          className={cn(ocrClass("notes"))}
          {...register("notes")}
        />
      </section>

      {/* ── Ítems (create mode only) ── */}
      {isCreateMode && (
        <DraftItemsSection
          items={draftItems}
          onAdd={(item) => setDraftItems((prev) => [...prev, item])}
          onRemove={(idx) => setDraftItems((prev) => prev.filter((_, i) => i !== idx))}
          onUpdate={(idx, item) => setDraftItems((prev) => prev.map((x, i) => i === idx ? item : x))}
        />
      )}

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
