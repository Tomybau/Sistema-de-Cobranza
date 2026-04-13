export const CURRENCIES = ["USD", "EUR", "ARS", "MXN"] as const;
export type Currency = typeof CURRENCIES[number];

export function isValidCurrency(currency: string): currency is Currency {
  return CURRENCIES.includes(currency as Currency);
}
