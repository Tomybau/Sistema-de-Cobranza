/**
 * Etiquetas canónicas para los tipos de ítem de contrato.
 * Usar este objeto en TODOS los componentes que muestren o seleccionen el tipo.
 * Nunca definir TYPE_LABELS local — importar desde acá.
 */
export const ITEM_TYPE_LABELS: Record<string, string> = {
  RECURRING_FIXED: "Mensualidad fija",
  RECURRING_VARIABLE: "Mensualidad variable",
  ONE_TIME: "Pago único",
  INSTALLMENT: "En cuotas",
  UNKNOWN: "Desconocido",
}
