import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
})

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
    <html lang="es" className={`h-full antialiased ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="h-full">{children}</body>
    </html>
  )
}
