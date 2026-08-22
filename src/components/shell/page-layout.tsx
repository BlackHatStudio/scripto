import type { ReactNode } from "react"

import { AppShell } from "@/components/shell/app-shell"

export function PageLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <AppShell title={title} subtitle={subtitle}>
      {children}
    </AppShell>
  )
}
