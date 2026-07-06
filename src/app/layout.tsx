import "./globals.css"

import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Scripto",
  description: "Multi-tenant speech correction and browser dictation platform.",
  icons: {
    icon: "/Scripto_Favicon.png",
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full dark">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  )
}
