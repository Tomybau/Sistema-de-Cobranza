import { Prisma } from "@prisma/client";

export function formatMoney(amount: number | string | Prisma.Decimal, currency: string) {
  const numberAmount = typeof amount === "object" ? amount.toNumber() : Number(amount);
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currency,
  }).format(numberAmount);
}

export function toDecimal(amount: number | string): Prisma.Decimal {
  return new Prisma.Decimal(amount);
}
