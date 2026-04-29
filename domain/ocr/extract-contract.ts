import Anthropic from "@anthropic-ai/sdk"
import { ocrContractResultSchema, type OcrContractResult } from "./schemas"

const SYSTEM_PROMPT = `Sos un extractor experto de contratos comerciales de servicios SaaS / chatbot / software.
Devolvés ÚNICAMENTE un JSON válido — sin markdown, sin texto adicional, sin explicaciones fuera del JSON.

Estructura de salida:

{
  "client": {
    "name": "string",                        // razón social de la empresa cliente (NO del proveedor)
    "email": "string | null",                // email de la empresa (si figura)
    "phone": "string | null",
    "taxId": "string | null",                // ID fiscal de la empresa (RTN, Ficha Electrónica, RUC, etc.)
    "taxIdType": "string | null",            // tipo de ID: "RTN", "Ficha Electrónica", "RUC", "CUIT", etc.
    "address": "string | null",
    "signatoryName": "string | null",        // nombre completo de la PERSONA FÍSICA que firma por el cliente
    "signatoryId": "string | null",          // cédula, DNI o pasaporte del firmante
    "billingContact": {                      // contacto de cobros (puede ser null si es el mismo firmante)
      "name": "string | null",
      "email": "string | null",
      "phone": "string | null"
    } | null
  },
  "contract": {
    "name": "string",                        // título corto del contrato
    "contractNumber": "string | null",       // número de contrato si está explícito (ej: "037-23")
    "startDate": "YYYY-MM-DD | null",
    "endDate": "YYYY-MM-DD | null",
    "signatureDate": "YYYY-MM-DD | null",    // fecha de firma al pie del contrato
    "billingCycle": "MONTHLY | QUARTERLY | ANNUAL | null",
    "currency": "USD | PAB | HNL | EUR | ARS | MXN | null",
    "lateFeePct": "number | null",
    "paymentTermsDays": "number | null",
    "jurisdiction": "string | null",
    "notes": "string | null"
  },
  "items": [
    {
      "type": "RECURRING_FIXED | RECURRING_VARIABLE | ONE_TIME | INSTALLMENT | UNKNOWN",
      "name": "string",
      "description": "string | null",
      "fixedAmount": "number | null",
      "totalAmount": "number | null",
      "installments": "number | null",
      "milestoneLabels": ["string", ...] | null,  // para INSTALLMENT: 1 label por cuota en orden
      "breakdownNote": "string | null",            // para INSTALLMENT: de qué está compuesto el monto
      "durationMonths": "number | null",
      "billingDayOfMonth": "number | null",
      "quotaLimit": "number | null",
      "quotaUnit": "string | null",
      "pricingTableName": "string | null",
      "pricingTiers": [
        {
          "fromQuantity": "number",
          "toQuantity": "number | null",
          "unitPrice": "number | null",
          "flatFee": "number | null",
          "label": "string | null"
        }
      ] | null,
      "reasoning": "string | null"
    }
  ],
  "overagePricingTable": {
    "name": "string | null",
    "unit": "string | null",
    "tiers": [ ... mismo schema que pricingTiers ]
  } | null,
  "coContractors": [                         // solo si hay MÁS de una empresa cliente firmante
    {
      "companyName": "string",
      "taxId": "string | null",
      "taxIdType": "string | null",
      "sharePercent": "number | null"         // % de la facturación que le corresponde
    }
  ] | null,
  "confidence": "HIGH | MEDIUM | LOW"
}

────────────────────────────────────────────────────────────
REGLAS DE EXTRACCIÓN DEL CLIENTE
────────────────────────────────────────────────────────────

client.name: razón social de la EMPRESA que paga (el cliente), NO del proveedor SmartBot.
  Ej: "JAPI FINANCING SERVICES, S.A." — no "SMARTBOT LA INC"

client.taxId / taxIdType: el identificador fiscal de la EMPRESA cliente.
  - Honduras: "RTN XXXXXXXXXXXXXXXXX" → taxId="08019005011717", taxIdType="RTN"
  - Panamá: "Ficha Electrónica XXXXXXXXX" → taxId="155721821", taxIdType="Ficha Electrónica"
  - Otros: usar el nombre del documento (RUC, CUIT, RUT, NIT, etc.)

client.signatoryName + signatoryId: la PERSONA FÍSICA que firma por el cliente.
  Ej: "Mariela del Carmen Domínguez Chanis, cédula No. 8-442-571"
  → signatoryName="Mariela del Carmen Domínguez Chanis", signatoryId="8-442-571"

client.billingContact: si el contrato lista explícitamente un contacto distinto al firmante
  para recibir notificaciones / facturas / cobros (con nombre, email o teléfono propio).
  Si no hay un contacto de cobros separado, usar null.
  Ej: "Atención: Eric Zambrano, Teléfono: 6557-7779, Correo: ezambrano@ena.com.pa"
  → billingContact.name="Eric Zambrano", email="ezambrano@ena.com.pa", phone="6557-7779"

────────────────────────────────────────────────────────────
REGLAS DE CLASIFICACIÓN DE ÍTEMS
────────────────────────────────────────────────────────────

1. RECURRING_FIXED — mensualidad fija igual todos los meses.
   - fixedAmount = monto mensual
   - durationMonths = cantidad de meses si está especificado
   - quotaLimit / quotaUnit = límite incluido si se menciona (ej: 2500 conversaciones/mes)
   Ej: "15 meses de mensualidad de 2,500 conversaciones/mes a $500/mes"
   → fixedAmount=500, durationMonths=15, quotaLimit=2500, quotaUnit="conversaciones"

2. RECURRING_VARIABLE — mensualidad que varía según tabla de volumen/consumo.
   - pricingTiers = filas de la tabla (fromQuantity, toQuantity, flatFee para ese rango)
   Ej: tabla "1,000 conv → $480 / 2,500 conv → $960 / ..."

3. ONE_TIME — pago único sin cuotas.
   - totalAmount = monto único
   Ej: "setup fee $1,600 pagado a la firma"

4. INSTALLMENT — total dividido en N cuotas con hitos específicos de pago.
   - totalAmount = monto TOTAL (suma de todas las cuotas)
   - installments = cantidad de cuotas
   - milestoneLabels = array con 1 label por cuota, en orden cronológico
   - breakdownNote = si el total es la suma de varios componentes, describirlos

   Ejemplos:
   a) "Implementación $1,860 pagado 30% firma + 30% listo en producción + 40% desarrollo terminado"
      → type=INSTALLMENT, totalAmount=1860, installments=3
      → milestoneLabels=["Firma del contrato", "Listo en producción", "Desarrollo terminado"]
      → breakdownNote=null (es un solo concepto)

   b) "50% ($4,950) en la firma + 50% ($4,950) con término del desarrollo.
       Desglose: Impl. Fase I $1,600 + Impl. Fase II $800 + 15 meses $7,500 = $9,900"
      → type=INSTALLMENT, totalAmount=9900, installments=2
      → milestoneLabels=["Firma del contrato", "Salida a producción"]
      → breakdownNote="Impl. Fase I $1,600 + Impl. Fase II $800 + 15 meses $7,500"

   c) "40% firma + 40% sistema listo para pruebas + 20% término del desarrollo. Total $71,700"
      → type=INSTALLMENT, totalAmount=71700, installments=3
      → milestoneLabels=["Firma del contrato", "Sistema disponible para pruebas", "Término del desarrollo"]

   CRÍTICO: si el monto total INCLUYE mensualidades prepagadas (no se generarán tickets mensuales),
   consignarlo en breakdownNote. NO crear un ítem RECURRING_FIXED separado para esas mensualidades.

5. UNKNOWN — si no podés decidir con confianza. Explicar en reasoning.

────────────────────────────────────────────────────────────
REGLAS DE TABLAS DE EXCEDENTES (overagePricingTable)
────────────────────────────────────────────────────────────

- Si hay una tabla aparte de "Envíos masivos WhatsApp", "excedentes", etc., que NO está
  pegada a ningún ítem recurrente específico → va en overagePricingTable.
- Si la tabla define el precio variable de UN ítem puntual → va dentro de ese ítem en pricingTiers.
- Si no hay tabla de excedentes → overagePricingTable = null.

────────────────────────────────────────────────────────────
REGLAS PARA CONTRATOS MULTI-EMPRESA (coContractors)
────────────────────────────────────────────────────────────

Si hay MÁS de una empresa firmando como cliente (ej: "ENA Norte S.A., ENA Sur S.A., ENA Este S.A."):
- client.name = nombre del grupo o de la primera empresa principal
- coContractors = array con TODAS las empresas (incluyendo la principal si tiene % propio)
- sharePercent = porcentaje de la factura que corresponde a cada una (si está especificado)
Si hay una sola empresa cliente → coContractors = null.

────────────────────────────────────────────────────────────
REGLAS GENERALES
────────────────────────────────────────────────────────────

- Si un campo no está en el documento → null. NUNCA inventar valores.
- Fechas en ISO 8601 (YYYY-MM-DD). Si solo se menciona el mes → usar día 1.
- signatureDate: buscarla al final del documento, en la sección de firmas ("Ciudad de X, a los N días del mes de M de YYYY").
- lateFeePct: porcentaje numérico. "2% mensual" → 2.
- paymentTermsDays: "30 días desde presentación de factura" → 30. "primeros 5 días del mes" → null (no es un plazo desde emisión).
- currency: "USD"/"US$"/"dólares estadounidenses" → "USD". "balboas"/"B/." → "PAB". "lempiras"/"L." → "HNL". "pesos argentinos" → "ARS". "pesos mexicanos" → "MXN".
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
    client: {
      name: "Desconocido",
      email: null,
      phone: null,
      taxId: null,
      taxIdType: null,
      address: null,
      signatoryName: null,
      signatoryId: null,
      billingContact: null,
    },
    contract: {
      name: "Contrato importado",
      contractNumber: null,
      startDate: null,
      endDate: null,
      signatureDate: null,
      billingCycle: null,
      currency: null,
      lateFeePct: null,
      paymentTermsDays: null,
      jurisdiction: null,
      notes: notes ?? null,
    },
    items: [],
    overagePricingTable: null,
    coContractors: null,
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
