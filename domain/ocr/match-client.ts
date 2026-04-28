import { prisma } from "@/db/client"
import type { Client, Company } from "@prisma/client"

export type ClientMatchConfidence = "EXACT" | "FUZZY" | "NONE"

export interface ClientMatchResult {
  client: Client | null
  company: Company | null
  confidence: ClientMatchConfidence
}

interface ExtractedClientInput {
  name?: string | null
  email?: string | null
  taxId?: string | null
}

export async function matchClient(
  extracted: ExtractedClientInput
): Promise<ClientMatchResult> {
  // 1. Match exacto por email del Client
  if (extracted.email) {
    const client = await prisma.client.findFirst({
      where: {
        email: { equals: extracted.email, mode: "insensitive" },
        deletedAt: null,
      },
      include: { company: true },
    })
    if (client) {
      return { client, company: client.company, confidence: "EXACT" }
    }
  }

  // 2. Match exacto por taxId de la Company
  if (extracted.taxId) {
    const company = await prisma.company.findFirst({
      where: {
        taxId: extracted.taxId,
        deletedAt: null,
      },
      include: {
        clients: {
          where: { deletedAt: null, isPrimary: true },
          take: 1,
        },
      },
    })
    if (company) {
      const primaryClient = company.clients[0] ?? null
      return {
        client: primaryClient,
        company,
        confidence: "EXACT",
      }
    }
  }

  // 3. Match fuzzy por nombre de Company
  if (extracted.name) {
    const company = await prisma.company.findFirst({
      where: {
        OR: [
          { legalName: { contains: extracted.name, mode: "insensitive" } },
          { tradeName: { contains: extracted.name, mode: "insensitive" } },
        ],
        deletedAt: null,
      },
      include: {
        clients: {
          where: { deletedAt: null, isPrimary: true },
          take: 1,
        },
      },
    })
    if (company) {
      const primaryClient = company.clients[0] ?? null
      return {
        client: primaryClient,
        company,
        confidence: "FUZZY",
      }
    }
  }

  return { client: null, company: null, confidence: "NONE" }
}
