import { z } from "zod";

const moneyRegex = /^\d+(\.\d{1,4})?$/;

export const pricingTierSchema = z.object({
  id: z.string().optional(), // Para actualizar tiers existentes
  fromQuantity: z.string().regex(moneyRegex, "Debe ser un número válido"),
  toQuantity: z.string().regex(moneyRegex, "Debe ser un número válido").optional().or(z.literal("").transform(() => undefined)),
  unitPrice: z.string().regex(moneyRegex, "Debe ser un número válido"),
  flatFee: z.string().regex(moneyRegex, "Debe ser un número válido").optional().or(z.literal("").transform(() => undefined)),
}).refine((val) => {
  if (val.toQuantity !== undefined) {
    return Number(val.fromQuantity) < Number(val.toQuantity);
  }
  return true;
}, {
  message: "El límite superior ('hasta') debe ser mayor al límite inferior ('desde').",
  path: ["toQuantity"],
});

export const pricingTableSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  description: z.string().optional(),
  tiers: z.array(pricingTierSchema).min(1, "Debe definir al menos un rango de precios (tier)"),
}).refine((val) => {
  const tiers = val.tiers;
  let prevTo: number | undefined = undefined;
  
  for (let i = 0; i < tiers.length; i++) {
    const from = Number(tiers[i].fromQuantity);
    const to = tiers[i].toQuantity !== undefined ? Number(tiers[i].toQuantity) : undefined;
    
    if (i > 0) {
      if (prevTo === undefined) {
        // Si el tier anterior no tiene límite superior, no puede haber más tiers.
        return false;
      }
      if (from < prevTo) {
        // Solapamiento o desorden detectado
        return false;
      }
    }
    
    prevTo = to;
  }
  return true;
}, {
  message: "Los rangos no deben superponerse y deben estar en orden ascendente. Si un rango no tiene límite superior, debe ser el último.",
  path: ["tiers"], // Marca todo el array como inválido (podríamos manejarlo de forma más específica si fuera necesario en la UI)
});

export type PricingTableFormValues = z.infer<typeof pricingTableSchema>;
export type PricingTierFormValues = z.infer<typeof pricingTierSchema>;
