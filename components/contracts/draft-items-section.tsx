"use client"

import { useState } from "react"
import { Plus, Trash2, Pencil, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DraftItemInput, DraftPricingTier } from "@/app/(dashboard)/contracts/types"

// ─── Local types (add React keys) ────────────────────────────────────────────

type LocalTier = DraftPricingTier & { _id: string }

type LocalDraft = {
  type: "RECURRING_FIXED" | "RECURRING_VARIABLE" | "ONE_TIME" | "INSTALLMENT"
  name: string
  description: string
  fixedAmount: string
  billingDayOfMonth: string
  totalAmount: string
  installments: string
  newPricingTableName: string
  quotaLimit: string
  quotaUnit: string
  durationMonths: string
  _tiers: LocalTier[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<LocalDraft["type"], string> = {
  RECURRING_FIXED: "Mensualidad fija",
  RECURRING_VARIABLE: "Variable (tabla de precios)",
  ONE_TIME: "Pago único",
  INSTALLMENT: "En cuotas",
}

function uid() {
  return Math.random().toString(36).slice(2)
}

function emptyDraft(): LocalDraft {
  return {
    type: "RECURRING_FIXED",
    name: "",
    description: "",
    fixedAmount: "",
    billingDayOfMonth: "1",
    totalAmount: "",
    installments: "2",
    newPricingTableName: "",
    quotaLimit: "",
    quotaUnit: "",
    durationMonths: "",
    _tiers: [newTier()],
  }
}

function newTier(): LocalTier {
  return { _id: uid(), from: "0", to: "", unitPrice: "0", flatFee: "" }
}

function fromInput(item: DraftItemInput): LocalDraft {
  return {
    type: item.type,
    name: item.name,
    description: item.description ?? "",
    fixedAmount: item.fixedAmount ?? "",
    billingDayOfMonth: item.billingDayOfMonth?.toString() ?? "1",
    totalAmount: item.totalAmount ?? "",
    installments: item.installments?.toString() ?? "2",
    newPricingTableName: item.newPricingTableName ?? "",
    quotaLimit: item.quotaLimit ?? "",
    quotaUnit: item.quotaUnit ?? "",
    durationMonths: item.durationMonths?.toString() ?? "",
    _tiers:
      item.newPricingTableTiers?.map((t) => ({ ...t, _id: uid() })) ?? [newTier()],
  }
}

function toInput(item: LocalDraft): DraftItemInput {
  return {
    type: item.type,
    name: item.name,
    description: item.description || undefined,
    fixedAmount: item.fixedAmount || undefined,
    billingDayOfMonth: item.billingDayOfMonth ? Number(item.billingDayOfMonth) : undefined,
    totalAmount: item.totalAmount || undefined,
    installments: item.installments ? Number(item.installments) : undefined,
    newPricingTableName: item.newPricingTableName || undefined,
    newPricingTableTiers:
      item.type === "RECURRING_VARIABLE"
        ? item._tiers.map((t) => ({
            from: t.from,
            to: t.to || undefined,
            unitPrice: t.unitPrice,
            flatFee: t.flatFee || undefined,
          }))
        : undefined,
    quotaLimit: item.quotaLimit || undefined,
    quotaUnit: item.quotaUnit || undefined,
    durationMonths: item.durationMonths ? Number(item.durationMonths) : undefined,
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DraftItemsSectionProps {
  items: DraftItemInput[]
  onAdd: (item: DraftItemInput) => void
  onRemove: (index: number) => void
  onUpdate: (index: number, item: DraftItemInput) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DraftItemsSection({ items, onAdd, onRemove, onUpdate }: DraftItemsSectionProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [draft, setDraft] = useState<LocalDraft>(emptyDraft())
  const [formError, setFormError] = useState<string | null>(null)
  const [expandedIndexes, setExpandedIndexes] = useState<Set<number>>(new Set())

  function setField<K extends keyof LocalDraft>(key: K, value: LocalDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function addTier() {
    setDraft((d) => ({ ...d, _tiers: [...d._tiers, newTier()] }))
  }

  function removeTier(id: string) {
    setDraft((d) => ({ ...d, _tiers: d._tiers.filter((t) => t._id !== id) }))
  }

  function updateTier(id: string, field: keyof DraftPricingTier, value: string) {
    setDraft((d) => ({
      ...d,
      _tiers: d._tiers.map((t) => (t._id === id ? { ...t, [field]: value } : t)),
    }))
  }

  function toggleExpand(idx: number) {
    setExpandedIndexes((prev) => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  function handleEdit(idx: number) {
    setEditingIndex(idx)
    setDraft(fromInput(items[idx]))
    setFormError(null)
    setShowForm(true)
    setExpandedIndexes((prev) => { const n = new Set(prev); n.delete(idx); return n })
  }

  function validate(): string | null {
    if (!draft.name.trim()) return "El nombre del ítem es obligatorio"
    if (draft.type === "RECURRING_FIXED") {
      if (!draft.fixedAmount.trim()) return "El monto fijo es obligatorio"
      if (!draft.billingDayOfMonth) return "El día de facturación es obligatorio"
    }
    if (draft.type === "RECURRING_VARIABLE") {
      if (!draft.newPricingTableName.trim()) return "El nombre de la tabla de precios es obligatorio"
      if (!draft._tiers.length) return "Debe agregar al menos un rango de precios"
      if (!draft.billingDayOfMonth) return "El día de facturación es obligatorio"
    }
    if (draft.type === "ONE_TIME") {
      if (!draft.totalAmount.trim()) return "El monto total es obligatorio"
    }
    if (draft.type === "INSTALLMENT") {
      if (!draft.totalAmount.trim()) return "El monto total es obligatorio"
      if (Number(draft.installments) < 2) return "Mínimo 2 cuotas"
      if (!draft.billingDayOfMonth) return "El día de facturación es obligatorio"
    }
    return null
  }

  function handleSave() {
    const err = validate()
    if (err) { setFormError(err); return }
    setFormError(null)
    const item = toInput(draft)
    if (editingIndex !== null) {
      onUpdate(editingIndex, item)
    } else {
      onAdd(item)
    }
    setDraft(emptyDraft())
    setEditingIndex(null)
    setShowForm(false)
  }

  function handleCancel() {
    setShowForm(false)
    setFormError(null)
    setEditingIndex(null)
    setDraft(emptyDraft())
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        Ítems del contrato
      </h3>

      {/* Item list */}
      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((item, idx) => {
            const isExpanded = expandedIndexes.has(idx)
            const isBeingEdited = editingIndex === idx && showForm
            return (
              <div
                key={idx}
                className={`rounded-md border text-sm ${
                  isBeingEdited
                    ? "border-primary/40 bg-primary/5"
                    : item.needsReview
                    ? "border-yellow-400/60 bg-yellow-50/40 dark:bg-yellow-900/10"
                    : ""
                }`}
              >
                {/* Header row */}
                <div className="flex items-center gap-3 px-3 py-2">
                  <span className="text-muted-foreground w-5 text-xs tabular-nums shrink-0">
                    {idx + 1}
                  </span>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {TYPE_LABELS[item.type]}
                  </Badge>
                  {item.needsReview && (
                    <Badge variant="secondary" className="text-xs shrink-0 bg-yellow-200 text-yellow-900">
                      Revisar
                    </Badge>
                  )}
                  <span className="flex-1 font-medium truncate">{item.name}</span>

                  {/* Amount summary */}
                  {item.type === "RECURRING_FIXED" && item.fixedAmount && (
                    <span className="text-muted-foreground tabular-nums text-xs shrink-0">
                      ${item.fixedAmount}/mes
                    </span>
                  )}
                  {item.type === "RECURRING_VARIABLE" && (
                    <span className="text-muted-foreground text-xs truncate max-w-[10rem] shrink-0">
                      {item.newPricingTableName}
                    </span>
                  )}
                  {(item.type === "ONE_TIME" || item.type === "INSTALLMENT") && item.totalAmount && (
                    <span className="text-muted-foreground tabular-nums text-xs shrink-0">
                      ${item.totalAmount}
                      {item.type === "INSTALLMENT" ? ` / ${item.installments} cuotas` : ""}
                    </span>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title={isExpanded ? "Colapsar" : "Ver detalles"}
                      onClick={() => toggleExpand(idx)}
                    >
                      {isExpanded
                        ? <ChevronUp className="h-3.5 w-3.5" />
                        : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Editar"
                      onClick={() => handleEdit(idx)}
                      disabled={showForm && editingIndex !== idx}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      title="Eliminar"
                      onClick={() => onRemove(idx)}
                      disabled={showForm && editingIndex === idx}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Badges row */}
                {(item.quotaLimit || item.durationMonths || item.description) && !isExpanded && (
                  <div className="flex items-center gap-2 pl-8 pb-2 pr-3 text-xs text-muted-foreground flex-wrap">
                    {item.quotaLimit && (
                      <Badge variant="outline" className="text-xs font-normal">
                        Incluye {item.quotaLimit} {item.quotaUnit ?? "unidades"}/mes
                      </Badge>
                    )}
                    {item.durationMonths && (
                      <Badge variant="outline" className="text-xs font-normal">
                        Vigencia {item.durationMonths} meses
                      </Badge>
                    )}
                    {item.description && (
                      <span className="truncate flex-1 italic">{item.description}</span>
                    )}
                  </div>
                )}

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t space-y-2 bg-muted/20">
                    {item.description && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">Descripción</p>
                        <p className="text-xs">{item.description}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                      {item.billingDayOfMonth != null && (
                        <div>
                          <span className="text-muted-foreground">Día de facturación: </span>
                          <span>{item.billingDayOfMonth}</span>
                        </div>
                      )}
                      {item.durationMonths != null && (
                        <div>
                          <span className="text-muted-foreground">Duración: </span>
                          <span>{item.durationMonths} meses</span>
                        </div>
                      )}
                      {item.quotaLimit && (
                        <div>
                          <span className="text-muted-foreground">Cuota incluida: </span>
                          <span>{item.quotaLimit} {item.quotaUnit ?? "unidades"}/mes</span>
                        </div>
                      )}
                      {item.type === "INSTALLMENT" && item.installments && (
                        <div>
                          <span className="text-muted-foreground">Cuotas: </span>
                          <span>{item.installments}</span>
                        </div>
                      )}
                      {item.totalAmount && (
                        <div>
                          <span className="text-muted-foreground">Monto total: </span>
                          <span>${item.totalAmount}</span>
                        </div>
                      )}
                      {item.fixedAmount && (
                        <div>
                          <span className="text-muted-foreground">Monto fijo: </span>
                          <span>${item.fixedAmount}/mes</span>
                        </div>
                      )}
                    </div>

                    {/* Pricing tiers */}
                    {item.type === "RECURRING_VARIABLE" && item.newPricingTableTiers && item.newPricingTableTiers.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Tabla: {item.newPricingTableName}
                        </p>
                        <div className="rounded border bg-background overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="text-left px-2 py-1 font-medium text-muted-foreground">Desde</th>
                                <th className="text-left px-2 py-1 font-medium text-muted-foreground">Hasta</th>
                                <th className="text-left px-2 py-1 font-medium text-muted-foreground">Precio unit.</th>
                                <th className="text-left px-2 py-1 font-medium text-muted-foreground">Fee fijo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.newPricingTableTiers.map((t, ti) => (
                                <tr key={ti} className="border-b last:border-0">
                                  <td className="px-2 py-1">{t.from}</td>
                                  <td className="px-2 py-1">{t.to ?? "∞"}</td>
                                  <td className="px-2 py-1">{t.unitPrice ? `$${t.unitPrice}` : "—"}</td>
                                  <td className="px-2 py-1">{t.flatFee ? `$${t.flatFee}` : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit form */}
      {showForm ? (
        <div className="rounded-md border p-4 space-y-4 bg-muted/20">
          <p className="text-xs font-medium text-muted-foreground">
            {editingIndex !== null ? `Editando ítem ${editingIndex + 1}` : "Nuevo ítem"}
          </p>

          {/* Type + Name */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>
                Tipo <span className="text-destructive">*</span>
              </Label>
              <Select
                value={draft.type}
                onValueChange={(v) => setField("type", v as LocalDraft["type"])}
                items={TYPE_LABELS}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un tipo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val} label={label}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                value={draft.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Ej: Soporte mensual"
              />
            </div>
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Descripción (opcional)</Label>
            <Input
              value={draft.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Descripción del ítem"
            />
          </div>

          {/* RECURRING_FIXED */}
          {draft.type === "RECURRING_FIXED" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  Monto fijo <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={draft.fixedAmount}
                  onChange={(e) => setField("fixedAmount", e.target.value)}
                  placeholder="1500.00"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Día de facturación <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={draft.billingDayOfMonth}
                  onChange={(e) => setField("billingDayOfMonth", e.target.value)}
                  placeholder="1"
                />
              </div>
            </div>
          )}

          {/* RECURRING_VARIABLE */}
          {draft.type === "RECURRING_VARIABLE" && (
            <div className="space-y-4">
              <div className="space-y-2 max-w-xs">
                <Label>
                  Día de facturación <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={draft.billingDayOfMonth}
                  onChange={(e) => setField("billingDayOfMonth", e.target.value)}
                  placeholder="1"
                />
              </div>
              {/* Pricing table builder */}
              <div className="rounded-md border p-3 space-y-3">
                <div className="space-y-2">
                  <Label>
                    Nombre de la tabla de precios <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={draft.newPricingTableName}
                    onChange={(e) => setField("newPricingTableName", e.target.value)}
                    placeholder="Ej: Tabla de soporte por horas"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Rangos de precios</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={addTier}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar rango
                    </Button>
                  </div>
                  {/* Tier rows */}
                  <div className="space-y-2">
                    {draft._tiers.map((tier, idx) => (
                      <div key={tier._id} className="grid grid-cols-5 gap-2 items-end">
                        <div className="space-y-1">
                          {idx === 0 && (
                            <span className="text-xs text-muted-foreground block">Desde</span>
                          )}
                          <Input
                            className="h-8 text-xs"
                            value={tier.from}
                            onChange={(e) => updateTier(tier._id, "from", e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-1">
                          {idx === 0 && (
                            <span className="text-xs text-muted-foreground block">Hasta</span>
                          )}
                          <Input
                            className="h-8 text-xs"
                            value={tier.to}
                            onChange={(e) => updateTier(tier._id, "to", e.target.value)}
                            placeholder="∞"
                          />
                        </div>
                        <div className="space-y-1">
                          {idx === 0 && (
                            <span className="text-xs text-muted-foreground block">
                              Precio unit.
                            </span>
                          )}
                          <Input
                            className="h-8 text-xs"
                            value={tier.unitPrice}
                            onChange={(e) => updateTier(tier._id, "unitPrice", e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-1">
                          {idx === 0 && (
                            <span className="text-xs text-muted-foreground block">Fee fijo</span>
                          )}
                          <Input
                            className="h-8 text-xs"
                            value={tier.flatFee}
                            onChange={(e) => updateTier(tier._id, "flatFee", e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeTier(tier._id)}
                          disabled={draft._tiers.length === 1}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ONE_TIME */}
          {draft.type === "ONE_TIME" && (
            <div className="space-y-2 max-w-xs">
              <Label>
                Monto total <span className="text-destructive">*</span>
              </Label>
              <Input
                value={draft.totalAmount}
                onChange={(e) => setField("totalAmount", e.target.value)}
                placeholder="5000.00"
              />
            </div>
          )}

          {/* INSTALLMENT */}
          {draft.type === "INSTALLMENT" && (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>
                  Monto total <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={draft.totalAmount}
                  onChange={(e) => setField("totalAmount", e.target.value)}
                  placeholder="9000.00"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Cuotas <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min={2}
                  max={60}
                  value={draft.installments}
                  onChange={(e) => setField("installments", e.target.value)}
                  placeholder="3"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Día de facturación <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={draft.billingDayOfMonth}
                  onChange={(e) => setField("billingDayOfMonth", e.target.value)}
                  placeholder="1"
                />
              </div>
            </div>
          )}

          {/* Cuota incluida + duración (opcional, recurrentes) */}
          {(draft.type === "RECURRING_FIXED" || draft.type === "RECURRING_VARIABLE") && (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Cuota incluida (cantidad)</Label>
                <Input
                  value={draft.quotaLimit}
                  onChange={(e) => setField("quotaLimit", e.target.value)}
                  placeholder="2500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Unidad</Label>
                <Input
                  value={draft.quotaUnit}
                  onChange={(e) => setField("quotaUnit", e.target.value)}
                  placeholder="conversaciones"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Duración (meses)</Label>
                <Input
                  type="number"
                  min={1}
                  value={draft.durationMonths}
                  onChange={(e) => setField("durationMonths", e.target.value)}
                  placeholder="15"
                />
              </div>
            </div>
          )}

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleSave}>
              {editingIndex !== null ? "Guardar cambios" : "Agregar ítem"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={handleCancel}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Agregar ítem
        </Button>
      )}
    </section>
  )
}
