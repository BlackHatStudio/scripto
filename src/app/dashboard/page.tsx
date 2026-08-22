import Link from "next/link"
import { ArrowUpRight, AudioWaveform, BookOpenText, ClipboardList, Mic, Sparkles, Users, Workflow } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageLayout } from "@/components/shell/page-layout"

const cards = [
  { label: "Personal dictionary terms", value: "128", icon: BookOpenText, href: "/dictionary/personal" },
  { label: "Shared dictionary terms", value: "76", icon: Users, href: "/dictionary/shared" },
  { label: "Replacement rules", value: "34", icon: Workflow, href: "/replacement-rules" },
  { label: "Voice functions", value: "18", icon: AudioWaveform, href: "/voice-functions" },
  { label: "Recent sessions", value: "12", icon: ClipboardList, href: "/history" },
  { label: "Active tenant", value: "Elevated Dynamics", icon: Mic, href: "/tenant-admin" },
]

export default function DashboardPage() {
  return (
    <PageLayout title="Dashboard" subtitle="Operational overview for the active tenant">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-cyan-400/15 bg-slate-950/70">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-cyan-400/15 text-cyan-100" variant="outline">
                <Sparkles className="h-3.5 w-3.5" />
                Live overview
              </Badge>
              <Badge variant="outline">WCAG AA ready</Badge>
            </div>
            <div className="space-y-3">
              <CardTitle className="max-w-2xl text-3xl tracking-tight text-white sm:text-4xl">
                A dense but readable control center for dictation, dictionaries, and tenant operations.
              </CardTitle>
              <CardDescription className="max-w-2xl text-base leading-7 text-slate-300">
                The layout keeps the primary actions visible, groups secondary modules into compact
                clusters, and preserves clear contrast on smaller screens.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Active tenant", "Elevated Dynamics"],
                ["Modules surfaced", "6"],
                ["Current access", "All systems go"],
                ["Recent activity", "12 minutes ago"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</p>
                  <p className="mt-2 text-sm font-medium text-white">{value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="w-full sm:w-auto" size="compact">
                <Link href="/dictation">
                  Open dictation
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full sm:w-auto" size="compact">
                <Link href="/tenant-admin">Review tenant settings</Link>
              </Button>
              <Button asChild variant="ghost" className="w-full sm:w-auto" size="compact">
                <Link href="/history">View history</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-950/55">
          <CardHeader>
            <CardTitle>Layout principles</CardTitle>
            <CardDescription>Designed for scanability, touch comfort, and quick task switching.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "Keep primary controls at the top and repeat them where users make decisions.",
              "Use compact buttons for dense controls, but preserve 44px touch targets on mobile.",
              "Group secondary modules into card sections with a single clear action.",
              "Keep keyboard focus visible on every interactive control.",
            ].map((item) => (
              <div key={item} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-300" />
                <p className="text-sm leading-6 text-slate-300">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.label} className="overflow-hidden">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <CardDescription>{card.label}</CardDescription>
                  <CardTitle className="text-3xl tracking-tight">{card.value}</CardTitle>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-400/20">
                  <card.icon className="h-5 w-5" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <Badge variant="outline">Live foundation data</Badge>
              <Button asChild variant="ghost" size="compact">
                <Link href={card.href}>
                  Open
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Major modules</CardTitle>
            <CardDescription>Shortcuts stay compact while remaining large enough to tap comfortably.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {[
              ["Browser dictation", "/dictation"],
              ["Personal dictionary", "/dictionary/personal"],
              ["Shared dictionary", "/dictionary/shared"],
              ["Command testing", "/voice-functions/test-detection"],
              ["Email profiles", "/email-profiles"],
              ["Audit log", "/audit"],
            ].map(([label, href]) => (
              <Button key={href} asChild variant="outline" className="justify-start" size="compact">
                <Link href={href}>{label}</Link>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Correction pipeline</CardTitle>
            <CardDescription>Each step is isolated so the flow is easier to reason about and debug.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">1. Transcription provider adapter</p>
            <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              2. Dictionary resolver with tenant scope isolation
            </p>
            <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">3. Replacement rule engine</p>
            <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">4. Voice function detector</p>
            <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">5. Formatter and correction logger</p>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}
