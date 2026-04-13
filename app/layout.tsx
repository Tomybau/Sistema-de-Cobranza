import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Cobranza — Sistema de gestión",
  description: "Sistema interno de gestión de cobranza y contratos",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="h-full">{children}</body>
    </html>
  )
}
