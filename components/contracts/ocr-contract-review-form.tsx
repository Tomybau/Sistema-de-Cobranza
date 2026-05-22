"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus, Trash2, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { contractSchema, type ContractFormValues } from "@/domain/contracts/schemas"
import { CURRENCIES } from "@/lib/currencies"
import { ITEM_TYPE_LABELS } from "@/lib/item-type-labels"
import { ocrResultToDraftItems } from "@/lib/ocr-to-draft-items"
import type { OcrContractResult, OcrPricingTier, OcrContractItem } from "@/domain/ocr/schemas"
import type { ClientMatchResult } from "@/domain/ocr/match-client"
import type {
  ActionResult,
  CreateContractFullInput,
  NewCompanyInput,
  NewClientInput,
} from "@/app/(dashboard)/contracts/types"
import { cn } from "@/lib/utils"

// ─── Constantes ───────────────────────────────────────────────────────────────

const CONFIDENCE_VARIANT: Record<string, "ok" | "warn" | "bad"> = {
  HIGH: "ok",
  MEDIUM: "warn",
  LOW: "bad",
}
const CONFIDENCE_LABEL: Record<string, string> = {
  HIGH: "Confianza alta",
  MEDIUM: "Confianza media",
  LOW: "Confianza baja",
}
const ITEM_TYPE_LABEL = ITEM_TYPE_LABELS
const ITEM_TYPES = [
  "RECURRING_FIXED",
  "RECURRING_VARIABLE",
  "ONE_TIME",
  "INSTALLMENT",
  "UNKNOWN",
] as const
const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  ENDED: "Finalizado",
  CANCELLED: "Cancelado",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function numOrNull(v: string): number | null {
  const n = parseFloat(v)
  return isNaN(n) ? null : n
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

// ─── TierTableEditor ──────────────────────────────────────────────────────────

interface TierTableEditorProps {
  tiers: OcrPricingTier[]
  onChangeTier: (i: number, field: keyof OcrPricingTier, value: number | null) => void
  onAddTier: () => void
  onRemoveTier: (i: number) => void
}

function TierTableEditor({ tiers, onChangeTier, onAddTier, onRemoveTier }: TierTableEditorProps) {
  return (
    <div className="space-y-1">
      <div className="rounded border overflow-hidden text-xs">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/60 text-muted-foreground">
              <th className="text-left px-2 py-1 font-medium w-24">Desde</th>
              <th className="text-left px-2 py-1 font-medium w-24">Hasta (∞=vacío)</th>
              <th className="text-left px-2 py-1 font-medium w-28">Precio unitario</th>
              <th className="text-left px-2 py-1 font-medium w-24">Fee fijo</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {tiers.map((tier, i) => (
              <tr key={i}>
                <td className="px-1 py-1">
                  <Input
                    type="number" min="0" step="any" className="h-6 text-xs px-1.5"
                    value={tier.fromQuantity ?? ""}
                    onChange={(e) => onChangeTier(i, "fromQuantity", numOrNull(e.target.value) ?? 0)}
                  />
                </td>
                <td className="px-1 py-1">
                  <Input
                    type="number" min="0" step="any" className="h-6 text-xs px-1.5"
                    value={tier.toQuantity ?? ""} placeholder="∞"
                    onChange={(e) =>
                      onChangeTier(i, "toQuantity", e.target.value === "" ? null : numOrNull(e.target.value))
                    }
                  />
                </td>
                <td className="px-1 py-1">
                  <Input
                    type="number" min="0" step="any" className="h-6 text-xs px-1.5"
                    value={tier.unitPrice ?? ""} placeholder="0"
                    onChange={(e) => onChangeTier(i, "unitPrice", numOrNull(e.target.value))}
                  />
                </td>
                <td className="px-1 py-1">
                  <Input
                    type="number" min="0" step="any" className="h-6 text-xs px-1.5"
                    value={tier.flatFee ?? ""} placeholder="—"
                    onChange={(e) =>
                      onChangeTier(i, "flatFee", e.target.value === "" ? null : numOrNull(e.target.value))
                    }
                  />
                </td>
                <td className="px-1 py-1">
                  <Button
                    type="button" size="icon" variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemoveTier(i)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={onAddTier}>
        <Plus className="mr-1 h-3 w-3" />
        Agregar fila
      </Button>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface OcrContractReviewFormProps {
  ocrData: OcrContractResult
  ocrMatch: ClientMatchResult
  ocrDocumentId: string | null
  companies: { id: string; legalName: string }[]
  createFullAction: (input: CreateContractFullInput) => Promise<ActionResult>
  onCancel: () => void
}

// ─── Componente principal ────────────────────────────────────────────────────

export function OcrContractReviewForm({
  ocrData,
  ocrMatch,
  ocrDocumentId,
  companies,
  createFullAction,
  onCancel,
}: OcrContractReviewFormProps) {
  // ── RHF para campos del contrato (pre-llenados desde OCR) ─────────────────
  const { register, handleSubmit, setValue, watch, formState: { errors } } =
    useForm<ContractFormValues>({
      resolver: zodResolver(contractSchema),
      defaultValues: {
        companyId: ocrMatch.company?.id ?? "__new__",
        contractNumber: ocrData.contract.contractNumber || suggestContractNumber(),
        title: ocrData.contract.name || "",
        description: "",
        currency: (ocrData.contract.currency || "USD") as ContractFormValues["currency"],
        startDate: ocrData.contract.startDate || "",
        endDate: ocrData.contract.endDate || "",
        status: "DRAFT" as ContractFormValues["status"],
        paymentTermsDays: ocrData.contract.paymentTermsDays ?? 15,
        lateFeePercent: ocrData.contract.lateFeePct ?? 0,
        notes: ocrData.contract.notes || "",
      },
    })

  const watchedCompanyId = watch("companyId")

  // ── Empresa / cliente ─────────────────────────────────────────────────────
  const [companyMode, setCompanyMode] = useState<"existing" | "new">(
    ocrMatch.company?.id ? "existing" : "new"
  )
  const [newCompany, setNewCompany] = useState<NewCompanyInput>({
    ...EMPTY_COMPANY,
    legalName: ocrData.client.name || "",
    taxId: ocrData.client.taxId || "",
    email: ocrData.client.email || "",
    phone: ocrData.client.phone || "",
    address: ocrData.client.address || "",
  })
  const [newClient, setNewClient] = useState<NewClientInput>({
    ...EMPTY_CLIENT,
    fullName: ocrData.client.name || "",
    email: ocrData.client.email || "",
    phone: ocrData.client.phone || "",
  })

  // ── Items editables (copia del OCR, el usuario los modifica antes de crear) ─
  const [editableData, setEditableData] = useState<OcrContractResult>(
    () => structuredClone(ocrData)
  )

  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // ── Helpers de mutación de items ─────────────────────────────────────────

  function updItem(idx: number, updates: Partial<OcrContractItem>) {
    setEditableData((p) => ({
      ...p,
      items: p.items.map((it, i) => (i === idx ? { ...it, ...updates } : it)),
    }))
  }

  function updItemTier(itemIdx: number, tierIdx: number, field: keyof OcrPricingTier, value: number | null) {
    setEditableData((p) => ({
      ...p,
      items: p.items.map((it, i) => {
        if (i !== itemIdx) return it
        const tiers = (it.pricingTiers ?? []).map((t, ti) =>
          ti === tierIdx ? { ...t, [field]: value } : t
        )
        return { ...it, pricingTiers: tiers }
      }),
    }))
  }

  function addItemTier(itemIdx: number) {
    setEditableData((p) => ({
      ...p,
      items: p.items.map((it, i) => {
        if (i !== itemIdx) return it
        const tiers = [
          ...(it.pricingTiers ?? []),
          { fromQuantity: 0, toQuantity: null, unitPrice: null, flatFee: null, label: null },
        ]
        return { ...it, pricingTiers: tiers }
      }),
    }))
  }

  function removeItemTier(itemIdx: number, tierIdx: number) {
    setEditableData((p) => ({
      ...p,
      items: p.items.map((it, i) => {
        if (i !== itemIdx) return it
        return { ...it, pricingTiers: (it.pricingTiers ?? []).filter((_, ti) => ti !== tierIdx) }
      }),
    }))
  }

  function updOverageTier(tierIdx: number, field: keyof OcrPricingTier, value: number | null) {
    setEditableData((p) => {
      if (!p.overagePricingTable) return p
      const tiers = p.overagePricingTable.tiers.map((t, ti) =>
        ti === tierIdx ? { ...t, [field]: value } : t
      )
      return { ...p, overagePricingTable: { ...p.overagePricingTable, tiers } }
    })
  }

  function addOverageTier() {
    setEditableData((p) => {
      if (!p.overagePricingTable) return p
      const tiers = [
        ...p.overagePricingTable.tiers,
        { fromQuantity: 0, toQuantity: null, unitPrice: null, flatFee: null, label: null },
      ]
      return { ...p, overagePricingTable: { ...p.overagePricingTable, tiers } }
    })
  }

  function removeOverageTier(tierIdx: number) {
    setEditableData((p) => {
      if (!p.overagePricingTable) return p
      return {
        ...p,
        overagePricingTable: {
          ...p.overagePricingTable,
          tiers: p.overagePricingTable.tiers.filter((_, ti) => ti !== tierIdx),
        },
      }
    })
  }

  function updItemPlanEntry(
    itemIdx: number,
    entryIdx: number,
    field: "label" | "percentage",
    value: string | number
  ) {
    setEditableData((p) => ({
      ...p,
      items: p.items.map((it, i) => {
        if (i !== itemIdx) return it
        const plan = (it.installmentPlan ?? []).map((e, ei) =>
          ei === entryIdx ? { ...e, [field]: value } : e
        )
        return { ...it, installmentPlan: plan }
      }),
    }))
  }

  function initItemPlan(itemIdx: number, installments: number) {
    setEditableData((p) => ({
      ...p,
      items: p.items.map((it, i) => {
        if (i !== itemIdx) return it
        const pct = installments > 0 ? parseFloat((100 / installments).toFixed(4)) : 0
        const plan = Array.from({ length: installments }, (_, k) => ({
          label: `Cuota ${k + 1}`,
          percentage: pct,
        }))
        return { ...it, installmentPlan: plan }
      }),
    }))
  }

  function clearItemPlan(itemIdx: number) {
    setEditableData((p) => ({
      ...p,
      items: p.items.map((it, i) => (i !== itemIdx ? it : { ...it, installmentPlan: null })),
    }))
  }

  // ── Company mode ──────────────────────────────────────────────────────────

  function handleCompanyModeChange(mode: "existing" | "new") {
    setCompanyMode(mode)
    setValue("companyId", mode === "new" ? "__new__" : (ocrMatch.company?.id ?? ""))
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  function onSubmit(values: ContractFormValues) {
    if (companyMode === "existing" && (!values.companyId || values.companyId === "__new__")) {
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

    setServerError(null)
    startTransition(async () => {
      const items = ocrResultToDraftItems(editableData)
      const result = await createFullAction({
        contract: values,
        companyMode,
        newCompany: companyMode === "new" ? newCompany : undefined,
        newClient: companyMode === "new" ? newClient : undefined,
        items,
        ocrDocumentId,
      })
      if (!result.success) {
        setServerError(result.error)
        toast.error(result.error)
      }
    })
  }

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-8">

      {/* Confianza OCR */}
      <div className="flex items-center gap-2 flex-wrap">
        <Sparkles className="h-4 w-4 text-yellow-600 shrink-0" />
        <Badge variant={CONFIDENCE_VARIANT[ocrData.confidence] ?? "outline"}>
          {CONFIDENCE_LABEL[ocrData.confidence] ?? ocrData.confidence}
        </Badge>
        {ocrData.confidence === "LOW" && (
          <p className="text-xs text-warn">Revisá todos los campos con cuidado.</p>
        )}
        {ocrMatch.company && (
          <Badge
            variant={ocrMatch.confidence === "EXACT" ? "default" : "secondary"}
            className="text-xs ml-auto"
          >
            {ocrMatch.confidence === "EXACT" ? "✓ Empresa encontrada" : "⚠ Posible match"}:{" "}
            {ocrMatch.company.legalName}
          </Badge>
        )}
      </div>

      {/* ── Empresa / Cliente ── */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Empresa
        </h3>

        <div className="flex gap-2">
          <Button
            type="button" size="sm" disabled={isPending}
            variant={companyMode === "existing" ? "default" : "outline"}
            onClick={() => handleCompanyModeChange("existing")}
          >
            Empresa existente
          </Button>
          <Button
            type="button" size="sm" disabled={isPending}
            variant={companyMode === "new" ? "default" : "outline"}
            onClick={() => handleCompanyModeChange("new")}
          >
            Nueva empresa
          </Button>
        </div>

        {companyMode === "existing" ? (
          <div className="space-y-2">
            <Label>Empresa <span className="text-destructive">*</span></Label>
            <Select
              value={watchedCompanyId}
              onValueChange={(v) => v != null && setValue("companyId", v)}
              disabled={isPending}
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
          </div>
        ) : (
          <div className="rounded-md border p-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Razón social <span className="text-destructive">*</span></Label>
                <Input
                  value={newCompany.legalName}
                  onChange={(e) => setNewCompany((p) => ({ ...p, legalName: e.target.value }))}
                  placeholder="Ej: Acme S.A."
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label>CUIT / RUT</Label>
                <Input
                  value={newCompany.taxId ?? ""}
                  onChange={(e) => setNewCompany((p) => ({ ...p, taxId: e.target.value }))}
                  placeholder="30-12345678-9"
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
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={newCompany.phone ?? ""}
                  onChange={(e) => setNewCompany((p) => ({ ...p, phone: e.target.value }))}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input
                  value={newCompany.address ?? ""}
                  onChange={(e) => setNewCompany((p) => ({ ...p, address: e.target.value }))}
                  placeholder="Av. Corrientes 1234, CABA"
                  disabled={isPending}
                />
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Contacto principal</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre completo <span className="text-destructive">*</span></Label>
                  <Input
                    value={newClient.fullName}
                    onChange={(e) => setNewClient((p) => ({ ...p, fullName: e.target.value }))}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email <span className="text-destructive">*</span></Label>
                  <Input
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient((p) => ({ ...p, email: e.target.value }))}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input
                    value={newClient.phone ?? ""}
                    onChange={(e) => setNewClient((p) => ({ ...p, phone: e.target.value }))}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rol / Cargo</Label>
                  <Input
                    value={newClient.role ?? ""}
                    onChange={(e) => setNewClient((p) => ({ ...p, role: e.target.value }))}
                    disabled={isPending}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <Separator />

      {/* ── Identificación ── */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Identificación
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contractNumber">
              Número de contrato <span className="text-destructive">*</span>
            </Label>
            <Input id="contractNumber" disabled={isPending} {...register("contractNumber")} />
            {errors.contractNumber && (
              <p className="text-sm text-destructive">{errors.contractNumber.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select
              defaultValue="DRAFT"
              onValueChange={(v) => v != null && setValue("status", v as ContractFormValues["status"])}
              disabled={isPending}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val} label={label}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="title">
              Título <span className="text-destructive">*</span>
            </Label>
            <Input id="title" disabled={isPending} {...register("title")}
              aria-invalid={!!errors.title} />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" rows={2} disabled={isPending} {...register("description")} />
          </div>
        </div>
      </section>

      {/* ── Condiciones ── */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Condiciones
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Moneda <span className="text-destructive">*</span></Label>
            <Select
              defaultValue={ocrData.contract.currency || "USD"}
              onValueChange={(v) =>
                v != null && setValue("currency", v as ContractFormValues["currency"])
              }
              disabled={isPending}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c} label={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">
              Fecha de inicio <span className="text-destructive">*</span>
            </Label>
            <Input id="startDate" type="date" disabled={isPending} {...register("startDate")}
              aria-invalid={!!errors.startDate} />
            {errors.startDate && (
              <p className="text-sm text-destructive">{errors.startDate.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">Fecha de fin (opcional)</Label>
            <Input id="endDate" type="date" disabled={isPending} {...register("endDate")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentTermsDays">Días para vencimiento</Label>
            <Input
              id="paymentTermsDays" type="number" min={0} max={90} disabled={isPending}
              {...register("paymentTermsDays", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lateFeePercent">% Mora</Label>
            <Input
              id="lateFeePercent" type="number" min={0} max={100} step="0.01" disabled={isPending}
              {...register("lateFeePercent", { valueAsNumber: true })}
            />
          </div>
        </div>
      </section>

      {/* ── Items ── */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Items ({editableData.items.length})
        </h3>

        {editableData.items.map((item, idx) => {
          const showPricingTiers =
            item.type === "RECURRING_VARIABLE" ||
            (item.pricingTiers && item.pricingTiers.length > 0)

          return (
            <div key={idx} className="rounded-md border p-3 space-y-3 bg-card">

              {/* Nombre + tipo */}
              <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                <div className="space-y-0.5">
                  <label className="text-xs text-muted-foreground">Nombre del item</label>
                  <Input
                    value={item.name}
                    onChange={(e) => updItem(idx, { name: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-xs text-muted-foreground">Tipo</label>
                  <Select
                    value={item.type}
                    onValueChange={(v) =>
                      updItem(idx, { type: v as OcrContractItem["type"] })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEM_TYPES.map((t) => (
                        <SelectItem key={t} value={t} label={ITEM_TYPE_LABEL[t]} className="text-xs">
                          {ITEM_TYPE_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Monto fijo */}
              {(item.type === "RECURRING_FIXED" || item.fixedAmount != null) && (
                <div className="space-y-0.5">
                  <label className="text-xs text-muted-foreground">Monto fijo mensual</label>
                  <Input
                    type="number" min="0" step="any" className="h-8 text-sm max-w-[160px]"
                    value={item.fixedAmount ?? ""} placeholder="0.00"
                    onChange={(e) => updItem(idx, { fixedAmount: numOrNull(e.target.value) })}
                  />
                </div>
              )}

              {/* Duración — solo para RECURRING_FIXED */}
              {item.type === "RECURRING_FIXED" && (
                <div className="space-y-0.5">
                  <label className="text-xs text-muted-foreground">Duración</label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      className={cn(
                        "h-7 px-2.5 text-xs rounded border font-medium transition-colors",
                        !item.durationMonths
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:bg-accent/70 text-muted-foreground"
                      )}
                      onClick={() => updItem(idx, { durationMonths: null })}
                    >
                      Mensual renovable
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "h-7 px-2.5 text-xs rounded border font-medium transition-colors",
                        item.durationMonths
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:bg-accent/70 text-muted-foreground"
                      )}
                      onClick={() =>
                        updItem(idx, { durationMonths: item.durationMonths ?? 12 })
                      }
                    >
                      Plazo fijo
                    </button>
                    {!!item.durationMonths && (
                      <div className="flex items-center gap-1 ml-1">
                        <Input
                          type="number" min="1" max="120" className="h-7 w-14 text-xs text-center"
                          value={item.durationMonths}
                          onChange={(e) =>
                            updItem(idx, { durationMonths: parseInt(e.target.value) || 1 })
                          }
                        />
                        <span className="text-xs text-muted-foreground">meses</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Descripción */}
              <div className="space-y-0.5">
                <label className="text-xs text-muted-foreground">Descripción</label>
                <Textarea
                  value={item.description ?? ""}
                  onChange={(e) => updItem(idx, { description: e.target.value || null })}
                  className="text-xs min-h-[56px] resize-none"
                  placeholder="Descripción del item..."
                />
              </div>

              {/* Monto total / cuotas */}
              {(item.type === "ONE_TIME" ||
                item.type === "INSTALLMENT" ||
                item.totalAmount != null) && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-xs text-muted-foreground">Monto total</label>
                    <Input
                      type="number" min="0" step="any" className="h-8 text-sm"
                      value={item.totalAmount ?? ""} placeholder="0.00"
                      onChange={(e) => updItem(idx, { totalAmount: numOrNull(e.target.value) })}
                    />
                  </div>
                  {(item.type === "INSTALLMENT" || (item.installments ?? 0) > 1) && (
                    <div className="space-y-0.5">
                      <label className="text-xs text-muted-foreground">Cuotas</label>
                      <Input
                        type="number" min="1" step="1" className="h-8 text-sm"
                        value={item.installments ?? ""} placeholder="2"
                        onChange={(e) =>
                          updItem(idx, { installments: numOrNull(e.target.value) })
                        }
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Desglose de cuotas con montos distintos */}
              {item.type === "INSTALLMENT" && (item.installments ?? 0) > 1 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={!!item.installmentPlan?.length}
                      onCheckedChange={(v) => {
                        if (v) initItemPlan(idx, item.installments ?? 2)
                        else clearItemPlan(idx)
                      }}
                    />
                    <label className="text-xs text-muted-foreground cursor-pointer select-none">
                      Cuotas con montos distintos
                    </label>
                  </div>
                  {item.installmentPlan && item.installmentPlan.length > 0 && (
                    <div className="rounded border overflow-hidden text-xs">
                      <div className="grid grid-cols-[auto_1fr_80px_80px] gap-0 bg-muted/40 px-2 py-1 text-muted-foreground font-medium">
                        <span className="w-6">#</span>
                        <span>Hito / descripción</span>
                        <span className="text-right">%</span>
                        <span className="text-right">Monto</span>
                      </div>
                      {item.installmentPlan.map((entry, ei) => {
                        const amount =
                          item.totalAmount && entry.percentage
                            ? (item.totalAmount * entry.percentage / 100).toFixed(2)
                            : "—"
                        return (
                          <div
                            key={ei}
                            className="grid grid-cols-[auto_1fr_80px_80px] gap-1 items-center px-2 py-1 border-t"
                          >
                            <span className="w-6 text-muted-foreground">{ei + 1}</span>
                            <Input
                              value={entry.label}
                              onChange={(e) =>
                                updItemPlanEntry(idx, ei, "label", e.target.value)
                              }
                              className="h-6 text-xs border-0 bg-transparent p-0 focus-visible:ring-0"
                              placeholder={`Cuota ${ei + 1}`}
                            />
                            <div className="flex items-center gap-0.5 justify-end">
                              <Input
                                type="number" min="0" max="100" step="0.01"
                                value={entry.percentage}
                                onChange={(e) =>
                                  updItemPlanEntry(idx, ei, "percentage", parseFloat(e.target.value) || 0)
                                }
                                className="h-6 text-xs w-14 text-right"
                              />
                              <span className="text-muted-foreground">%</span>
                            </div>
                            <span className="text-right tabular-nums text-muted-foreground">
                              {amount !== "—" ? `$${amount}` : "—"}
                            </span>
                          </div>
                        )
                      })}
                      {(() => {
                        const total = item.installmentPlan.reduce(
                          (s, e) => s + e.percentage,
                          0
                        )
                        const ok = Math.abs(total - 100) < 0.01
                        return (
                          <div
                            className={cn(
                              "px-2 py-1 border-t text-right text-xs font-medium",
                              ok ? "text-green-600" : "text-destructive"
                            )}
                          >
                            Total: {total.toFixed(2)}%{!ok && " (debe ser 100%)"}
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Tabla de precios */}
              {showPricingTiers && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">Tabla de precios</label>
                    <Input
                      value={item.pricingTableName ?? ""}
                      onChange={(e) =>
                        updItem(idx, { pricingTableName: e.target.value || null })
                      }
                      className="h-6 text-xs max-w-[200px]"
                      placeholder="Nombre de la tabla"
                    />
                  </div>
                  <TierTableEditor
                    tiers={item.pricingTiers ?? []}
                    onChangeTier={(ti, field, value) => updItemTier(idx, ti, field, value)}
                    onAddTier={() => addItemTier(idx)}
                    onRemoveTier={(ti) => removeItemTier(idx, ti)}
                  />
                </div>
              )}

              {/* Breakdown note */}
              {item.breakdownNote && (
                <div className="space-y-0.5">
                  <label className="text-xs text-muted-foreground">Desglose del monto</label>
                  <Input
                    value={item.breakdownNote}
                    onChange={(e) => updItem(idx, { breakdownNote: e.target.value || null })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              )}
            </div>
          )
        })}
      </section>

      {/* ── Tabla de excedentes ── */}
      {editableData.overagePricingTable && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Tabla de excedentes
          </h3>
          <div className="rounded-md border p-3 space-y-3 bg-card">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <label className="text-xs text-muted-foreground">Nombre</label>
                <Input
                  value={editableData.overagePricingTable.name ?? ""}
                  onChange={(e) =>
                    setEditableData((p) =>
                      p.overagePricingTable
                        ? { ...p, overagePricingTable: { ...p.overagePricingTable, name: e.target.value || null } }
                        : p
                    )
                  }
                  className="h-8 text-sm"
                  placeholder="Tabla de excedentes"
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-xs text-muted-foreground">Unidad</label>
                <Input
                  value={editableData.overagePricingTable.unit ?? ""}
                  onChange={(e) =>
                    setEditableData((p) =>
                      p.overagePricingTable
                        ? { ...p, overagePricingTable: { ...p.overagePricingTable, unit: e.target.value || null } }
                        : p
                    )
                  }
                  className="h-8 text-sm"
                  placeholder="mensajes, GB, usuarios..."
                />
              </div>
            </div>
            <TierTableEditor
              tiers={editableData.overagePricingTable.tiers}
              onChangeTier={(ti, field, value) => updOverageTier(ti, field, value)}
              onAddTier={addOverageTier}
              onRemoveTier={removeOverageTier}
            />
          </div>
        </section>
      )}

      {/* ── Notas ── */}
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
          Crear contrato
        </Button>
        <Button type="button" variant="outline" disabled={isPending} onClick={onCancel}>
          Cancelar importación
        </Button>
      </div>
    </form>
  )
}
