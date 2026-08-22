"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Mic, ShieldCheck, Sparkles, Workflow } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { hasStoredSession } from "@/lib/api"

const highlights = [
  {
    title: "Browser dictation",
    description: "Capture audio, send it to the API, and apply tenant-aware correction logic.",
    icon: Mic,
  },
  {
    title: "Tenant isolation",
    description: "Every request resolves an active tenant and enforces RBAC before data access.",
    icon: ShieldCheck,
  },
  {
    title: "Correction pipeline",
    description: "Dictionary, replacement, function detection, and formatting boundaries are isolated.",
    icon: Workflow,
  },
]

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    if (hasStoredSession()) {
      router.replace("/dashboard")
    }
  }, [router])

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <section className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 shadow-[0_0_40px_rgba(34,211,238,0.12)]">
              <Sparkles className="h-4 w-4" />
              Scripto by Elevated Dynamics
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-white md:text-7xl">
                Multi-tenant speech correction built for professional dictation.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-300">
                A dark, enterprise-grade foundation for browser dictation, personal and shared
                dictionaries, spoken command detection, audit logging, and future iOS expansion.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/signup">
                  Start signup <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </section>

          <Card className="border-cyan-400/15 bg-slate-950/75">
            <CardHeader>
              <CardTitle>Foundation status</CardTitle>
              <CardDescription>Core modules are scaffolded for the MVP.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {highlights.map((item) => (
                <div key={item.title} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/5 p-4 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-medium text-white">{item.title}</div>
                    <p className="mt-1 text-sm text-slate-400">{item.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
