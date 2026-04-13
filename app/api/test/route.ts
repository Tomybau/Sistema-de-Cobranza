import { prisma } from "@/db/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const all = await prisma.company.findMany()
  return NextResponse.json({ all })
}
