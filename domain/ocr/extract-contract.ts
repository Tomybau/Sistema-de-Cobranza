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
      "installmentPlan": [                         // para INSTALLMENT: 1 entrada por cuota en orden cronológico
        { "label": "string", "percentage": number } // label = descripción del hito, percentage = % del total
      ] | null,
      "breakdownNote": "string | null",            // para INSTALLMENT: de qué está compuesto el monto total
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
      "impliedRecurring": {                    // solo para INSTALLMENT que incluye mensualidades prepagadas
        "fixedAmount": number,                 // monto mensual una vez activado
        "billingDayOfMonth": number | null,    // día de facturación (o null si no especificado)
        "activatesAfterMonths": number,        // N meses desde startDate del contrato
        "quotaLimit": number | null,           // límite de conversaciones/unidades incluidas
        "quotaUnit": string | null             // unidad (ej: "conversaciones")
      } | null,
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

client.billingContact: la persona designada para recibir avisos de cobro o facturación.
  Extraer si hay cualquier mención de "Atención:", "Contacto:", "Para cobros:", "Notificaciones a:",
  u otra frase similar, acompañada del nombre de una PERSONA FÍSICA (no de la empresa en general).
  Si no hay tal mención → null.

  CRÍTICO para contratos multi-empresa:
  La sección "A LAS CONTRATANTES:" suele contener el contacto de cobros (ej: "Atención: Eric Zambrano,
  Teléfono: 6557-7779, Correo: ezambrano@ena.com.pa"). Ese dato ES el billingContact.
  NO coloques la razón social de la empresa en billingContact.name.

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
   - installmentPlan = array con 1 entrada por cuota en orden cronológico.
     Cada entrada: { label: "descripción del hito", percentage: número }
     El sistema calcula el monto de cada cuota = percentage / 100 × totalAmount.
     NO calcules el monto de cada cuota — solo extrae el porcentaje.
   - breakdownNote = si el total es la suma de varios componentes, describirlos.
   - Si el contrato NO especifica porcentajes distintos → installmentPlan = null
     (el sistema dividirá en partes iguales).

   Ejemplos:
   a) "Implementación $1,860 pagado 30% firma + 30% listo en producción + 40% desarrollo terminado"
      → type=INSTALLMENT, totalAmount=1860, installments=3
      → installmentPlan=[
          {"label": "Firma del contrato",     "percentage": 30},
          {"label": "Listo en producción",    "percentage": 30},
          {"label": "Desarrollo terminado",   "percentage": 40}
        ]
      → breakdownNote=null

   b) "50% ($4,950) en la firma + 50% ($4,950) con término del desarrollo.
       Desglose: Impl. Fase I $1,600 + Impl. Fase II $800 + 15 meses $7,500 = $9,900"
      → type=INSTALLMENT, totalAmount=9900, installments=2
      → installmentPlan=[
          {"label": "Firma del contrato",    "percentage": 50},
          {"label": "Salida a producción",   "percentage": 50}
        ]
      → breakdownNote="Impl. Fase I $1,600 + Impl. Fase II $800 + 15 meses $7,500"

   c) "40% firma + 40% sistema listo para pruebas + 20% término del desarrollo. Total $71,700"
      → type=INSTALLMENT, totalAmount=71700, installments=3
      → installmentPlan=[
          {"label": "Firma del contrato",                    "percentage": 40},
          {"label": "Sistema disponible para pruebas",       "percentage": 40},
          {"label": "Término del desarrollo",                "percentage": 20}
        ]

   d) "Implementación en 3 cuotas iguales de $600 c/u. Total $1,800"
      → type=INSTALLMENT, totalAmount=1800, installments=3, installmentPlan=null
      (partes iguales — el sistema calcula $600 cada una)

   CRÍTICO: si el monto total INCLUYE mensualidades prepagadas (no se generarán tickets mensuales),
   consignarlo en breakdownNote. NO crear un ítem RECURRING_FIXED separado para esas mensualidades.
   En cambio, si el contrato TAMBIÉN especifica que esa mensualidad continúa automáticamente después
   del período prepagado → completar impliedRecurring en ese mismo ítem INSTALLMENT.

5. UNKNOWN — si no podés decidir con confianza. Explicar en reasoning.

────────────────────────────────────────────────────────────
REGLAS DE impliedRecurring (mensualidad que se activa al terminar el prepago)
────────────────────────────────────────────────────────────

Completar impliedRecurring SOLO cuando se cumplan LAS DOS condiciones:
  a) El ítem es de tipo INSTALLMENT
  b) El contrato indica explícitamente que esas cuotas incluyen mensualidades prepagadas
     Y que, terminado ese período, la mensualidad continúa (ya sea por renovación automática
     o por cláusula explícita de continuidad).

Campos:
  - fixedAmount: monto mensual regular (el que se pagará cada mes una vez activado)
  - activatesAfterMonths: cantidad de meses prepagados (= el período cubierto en el INSTALLMENT)
  - billingDayOfMonth: día de cobro mensual si se menciona, null si no.
  - quotaLimit / quotaUnit: si la mensualidad incluye un límite de uso (ej: 2500 conversaciones/mes)

Ejemplo:
  "50% firma + 50% producción. Desglose: Impl. $1,600 + 15 meses de mensualidad $500/mes (2500 conv) = $9,100.
   Al término de los 15 meses el servicio se renueva mensualmente."
  → INSTALLMENT totalAmount=9100, installments=2, breakdownNote="Impl. $1,600 + 15 meses $7,500"
  → impliedRecurring={ fixedAmount:500, activatesAfterMonths:15, billingDayOfMonth:null, quotaLimit:2500, quotaUnit:"conversaciones" }

Si el contrato NO dice que la mensualidad continúa después del prepago → impliedRecurring = null.

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
