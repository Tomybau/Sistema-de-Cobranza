import Anthropic from "@anthropic-ai/sdk"
import { ocrContractResultSchema, type OcrContractResult } from "./schemas"

const SYSTEM_PROMPT = `Sos un extractor experto de contratos comerciales de servicios SaaS / chatbot / software.
Devolvés ÚNICAMENTE un JSON válido — sin markdown, sin texto adicional, sin explicaciones fuera del JSON.

Estructura de salida:

{
  "client": {
    "name": "string",                       // razón social del cliente (no del proveedor)
    "email": "string | null",
    "phone": "string | null",
    "taxId": "string | null",               // CUIT/RUT/RTN/ID fiscal
    "address": "string | null"
  },
  "contract": {
    "name": "string",                       // título del contrato (corto)
    "startDate": "YYYY-MM-DD | null",
    "endDate": "YYYY-MM-DD | null",
    "billingCycle": "MONTHLY | QUARTERLY | ANNUAL | null",
    "currency": "USD | PAB | HNL | EUR | ARS | MXN | null",
    "lateFeePct": "number | null",          // % mora (ej: 2 para 2%)
    "paymentTermsDays": "number | null",    // días para vencimiento desde factura (ej: 60)
    "jurisdiction": "string | null",        // país/ciudad de jurisdicción legal
    "notes": "string | null"
  },
  "items": [
    {
      "type": "RECURRING_FIXED | RECURRING_VARIABLE | ONE_TIME | INSTALLMENT | UNKNOWN",
      "name": "string",                     // nombre corto (ej: "Mensualidad chatbot")
      "description": "string | null",
      "fixedAmount": "number | null",       // monto MENSUAL si RECURRING_FIXED
      "totalAmount": "number | null",       // total acumulado para ONE_TIME / INSTALLMENT
      "installments": "number | null",      // cantidad de cuotas para INSTALLMENT
      "durationMonths": "number | null",    // meses de vigencia del ítem recurrente
      "billingDayOfMonth": "number | null", // 1-28
      "quotaLimit": "number | null",        // ej: 2500 (conversaciones/mes incluidas)
      "quotaUnit": "string | null",         // ej: "conversaciones", "horas", "mensajes"
      "pricingTableName": "string | null",  // si tiene tabla propia (variable)
      "pricingTiers": [                     // null si no aplica
        {
          "fromQuantity": "number",
          "toQuantity": "number | null",    // null = sin tope superior
          "unitPrice": "number | null",
          "flatFee": "number | null",       // fee fijo del rango si aplica
          "label": "string | null"
        }
      ] | null,
      "reasoning": "string | null"          // breve justificación (1 frase) del clasificador
    }
  ],
  "overagePricingTable": {                  // tabla de excedentes GLOBAL del contrato (no asociada a un ítem específico)
    "name": "string | null",
    "unit": "string | null",                // ej: "mensajes WhatsApp"
    "tiers": [ ... mismo schema que pricingTiers ]
  } | null,
  "confidence": "HIGH | MEDIUM | LOW"
}

Reglas de clasificación de ítems (razoná antes de elegir):

1. **RECURRING_FIXED** — pago mensual fijo, mismo monto todos los meses.
   Ej: "mensualidad de $500/mes por 15 meses" → fixedAmount=500, durationMonths=15.
   Si menciona límite de uso ("incluye 2500 conversaciones"), poner quotaLimit=2500, quotaUnit="conversaciones".

2. **RECURRING_VARIABLE** — mensualidad calculada por una tabla (ej: por horas, por consumo). Llenar pricingTiers con los rangos.

3. **ONE_TIME** — un solo pago. Ej: "setup fee $1,600 pagado a la firma".

4. **INSTALLMENT** — total dividido en N cuotas iguales o casi iguales.
   Ej: "Setup $2,400 pagado 50% firma + 50% salida producción" → totalAmount=2400, installments=2.
   Ej: "Implementación $9,000 en 3 cuotas" → totalAmount=9000, installments=3.

5. **UNKNOWN** — usalo si NO podés decidir con confianza. Llená reasoning explicando la duda.

Reglas de la tabla de excedentes (overagePricingTable):
- Si ves una tabla aparte tipo "Envíos masivos por WhatsApp: 3000→$300, 10000→$950..." y NO está pegada a un ítem específico, ponela en overagePricingTable.
- Si la tabla es claramente la facturación variable de un único ítem, ponela dentro de pricingTiers de ese ítem.

Reglas generales:
- Si un campo no está en el documento, usar null. NUNCA inventes valores.
- Fechas en ISO 8601 (YYYY-MM-DD). Si solo está el mes, usar día 1.
- lateFeePct es un porcentaje numérico (ej: 2 para 2%). Si dice "2% mensual" → 2.
- paymentTermsDays: extraer "60 días" / "30 días" → número. Si no se menciona, null.
- currency: convertir "USD" / "US$" / "dólares estadounidenses" → "USD". "balboas" / "B/." → "PAB". "lempiras" / "L." → "HNL". "pesos argentinos" → "ARS". "pesos mexicanos" → "MXN".
- "name" del cliente: razón social del CLIENTE que va a pagar, NO del proveedor del servicio.
- confidence: HIGH si todo claro, MEDIUM si algunos campos dudosos, LOW si hay ambigüedades importantes.`

const SUPPORTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const

type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number]

function isImageType(mime: string): mime is SupportedImageType {
  return SUPPORTED_IMAGE_TYPES.includes(mime as SupportedImageType)
}

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

const MODEL = "claude-sonnet-4-6"

function fallbackResult(notes?: string): OcrContractResult {
  return {
    client: { name: "Desconocido", email: null, phone: null, taxId: null, address: null },
    contract: {
      name: "Contrato importado",
      startDate: null,
      endDate: null,
      billingCycle: null,
      currency: null,
      lateFeePct: null,
      paymentTermsDays: null,
      jurisdiction: null,
      notes: notes ?? null,
    },
    items: [],
    overagePricingTable: null,
    confidence: "LOW",
  }
}

export async function extractContractFromFile(
  buffer: Buffer,
  mimeType: string
): Promise<OcrContractResult> {
  const base64 = buffer.toString("base64")
  const anthropic = getClient()

  let response: Anthropic.Messages.Message

  if (mimeType === "application/pdf") {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64 },
            },
            { type: "text", text: "Extrae los datos de este contrato siguiendo el schema." },
          ],
        },
      ],
    })
  } else if (isImageType(mimeType)) {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType, data: base64 },
            },
            { type: "text", text: "Extrae los datos de este contrato siguiendo el schema." },
          ],
        },
      ],
    })
  } else {
    throw new Error(`Tipo de archivo no soportado para OCR: ${mimeType}`)
  }

  const textBlock = response.content.find((b) => b.type === "text")
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude no devolvió texto en la respuesta")
  }

  const raw = textBlock.text
    .trim()
    .replace(/^```json?\n?/, "")
    .replace(/\n?```$/, "")

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return fallbackResult(raw.slice(0, 500))
  }

  const result = ocrContractResultSchema.safeParse(parsed)
  if (!result.success) {
    const partial = parsed as Record<string, unknown>
    const fb = fallbackResult()
    const partialClient = (partial?.client as Record<string, unknown>) ?? {}
    const partialContract = (partial?.contract as Record<string, unknown>) ?? {}
    return {
      ...fb,
      client: {
        ...fb.client,
        name: typeof partialClient.name === "string" ? partialClient.name : fb.client.name,
      },
      contract: {
        ...fb.contract,
        name:
          typeof partialContract.name === "string"
            ? partialContract.name
            : fb.contract.name,
      },
    }
  }

  return result.data
}
