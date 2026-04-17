import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/db/client"

// Resend sends webhook events; we handle `email.bounced` and `email.complained`
// to mark the corresponding EmailLog as BOUNCED.
//
// Docs: https://resend.com/docs/dashboard/webhooks/introduction
// Signature verification: https://resend.com/docs/dashboard/webhooks/event-types

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    // Webhook secret not configured — skip silently in dev
    return NextResponse.json({ ok: true })
  }

  // Verify Svix signature
  const svixId = req.headers.get("svix-id")
  const svixTimestamp = req.headers.get("svix-timestamp")
  const svixSignature = req.headers.get("svix-signature")

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing Svix headers" }, { status: 400 })
  }

  const body = await req.text()

  // Simple HMAC-SHA256 verification (Svix uses this format)
  const { createHmac } = await import("crypto")
  const toSign = `${svixId}.${svixTimestamp}.${body}`
  const expectedSig = createHmac("sha256", secret).update(toSign).digest("base64")

  // svix-signature may have multiple values like "v1,<sig>"
  const sigParts = svixSignature.split(" ")
  const verified = sigParts.some((part) => {
    const sigValue = part.startsWith("v1,") ? part.slice(3) : part
    return sigValue === expectedSig
  })

  if (!verified) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let event: { type: string; data: { email_id?: string; to?: string[] } }
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Handle bounce and complaint events
  if (event.type === "email.bounced" || event.type === "email.complained") {
    const resendMessageId = event.data?.email_id
    if (resendMessageId) {
      await prisma.emailLog.updateMany({
        where: { resendMessageId },
        data: { status: "BOUNCED" },
      })
    }
  }

  return NextResponse.json({ ok: true })
}
