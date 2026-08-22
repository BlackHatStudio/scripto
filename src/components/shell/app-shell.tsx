"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  AudioWaveform,
  BookOpenText,
  BriefcaseBusiness,
  ClipboardList,
  FileText,
  LaptopMinimal,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  Workflow,
} from "lucide-react"
import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { clearSession, forgetCredentials } from "@/lib/api"
import { cn } from "@/lib/utils"

type NavItem = {
  href: string
  label: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/dictation", label: "Browser Dictation", icon: <Mic className="h-4 w-4" /> },
  { href: "/dictionary/personal", label: "Personal Dictionary", icon: <BookOpenText className="h-4 w-4" /> },
  { href: "/dictionary/shared", label: "Shared Dictionary", icon: <Users className="h-4 w-4" /> },
  { href: "/dictionary/categories", label: "Dictionary Categories", icon: <BookOpenText className="h-4 w-4" /> },
  { href: "/replacement-rules", label: "Replacement Rules", icon: <Workflow className="h-4 w-4" /> },
  { href: "/phrase-templates", label: "Phrase Templates", icon: <FileText className="h-4 w-4" /> },
  { href: "/voice-functions", label: "Voice Functions", icon: <AudioWaveform className="h-4 w-4" /> },
  { href: "/email-profiles", label: "Email Profiles", icon: <FileText className="h-4 w-4" /> },
  { href: "/email-signatures", label: "HTML Signatures", icon: <FileText className="h-4 w-4" /> },
  { href: "/tenant-admin", label: "Tenant Management", icon: <BriefcaseBusiness className="h-4 w-4" /> },
  { href: "/users", label: "Users & Roles", icon: <UserRound className="h-4 w-4" /> },
  { href: "/devices", label: "Device Sessions", icon: <LaptopMinimal className="h-4 w-4" /> },
  { href: "/audit", label: "Audit Log", icon: <ShieldCheck className="h-4 w-4" /> },
  { href: "/history", label: "Correction History", icon: <ClipboardList className="h-4 w-4" /> },
  { href: "/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
]

export function AppShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode
  title: string
  subtitle?: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.12),_transparent_32%),linear-gradient(180deg,_#08111f_0%,_#060b14_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 px-4 py-4 lg:px-6">
        <aside
          className={cn(
            "fixed inset-y-4 left-4 z-40 w-72 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/80 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] lg:static lg:translate-x-0",
            mobileNavOpen ? "translate-x-0" : "-translate-x-[110%] lg:translate-x-0"
          )}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-white/10 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-400/30 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
                  <Workflow className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Elevated Dynamics</div>
                  <div className="text-lg font-semibold">Scripto</div>
                </div>
              </div>
              <Badge variant="outline" className="mt-4">
                Multi-tenant dictation foundation
              </Badge>
            </div>

            <nav className="flex-1 space-y-1 p-3">
              {navItems.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(`${item.href}/`)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm transition-[transform,background-color,color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
                      active
                        ? "bg-cyan-400/15 text-cyan-100 ring-1 ring-cyan-400/25 shadow-[0_10px_30px_rgba(34,211,238,0.08)]"
                        : "text-slate-300 hover:-translate-y-[1px] hover:bg-white/5 hover:text-white"
                    )}
                    onClick={() => setMobileNavOpen(false)}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>

            <div className="border-t border-white/10 p-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium">Environment</p>
                <p className="mt-1 text-sm text-slate-400">
                  Dark enterprise UI, local Postgres-ready backend, browser dictation, and audit logging.
                </p>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1 lg:pl-0">
          <header className="mb-6 rounded-3xl border border-white/10 bg-slate-950/60 px-4 py-4 shadow-2xl backdrop-blur-xl lg:px-6">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileNavOpen((value) => !value)}
              >
                <Menu className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-slate-400">
                  <span>Scripto</span>
                  <span className="text-slate-600">/</span>
                  <span>{title}</span>
                </div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">{title}</h1>
                {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <select
                  aria-label="Switch workspace"
                  className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-slate-100 outline-none"
                  defaultValue="elevated-dynamics"
                >
                  <option value="elevated-dynamics">Elevated Dynamics</option>
                  <option value="northwind-health">Northwind Health</option>
                  <option value="default">Personal Workspace</option>
                </select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    clearSession()
                    forgetCredentials()
                    router.push("/login")
                  }}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>

          <main className="pb-10">{children}</main>
        </div>
      </div>
    </div>
  )
}
