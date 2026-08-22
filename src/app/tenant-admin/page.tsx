"use client"

import { useState } from "react"
import {
  Building2,
  CheckCircle2,
  CircleAlert,
  FolderLock,
  KeyRound,
  LucideIcon,
  Search,
  ShieldCheck,
  SquarePen,
  Users,
  Workflow,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PageLayout } from "@/components/shell/page-layout"
import { cn } from "@/lib/utils"

type TenantStatus = "active" | "trial" | "pending" | "suspended"
type PlanName = "Starter" | "Growth" | "Enterprise"

type ModuleAccess = {
  key: string
  label: string
  enabled: boolean
}

type CustomerTenant = {
  id: string
  name: string
  slug: string
  owner: string
  email: string
  plan: PlanName
  seatsUsed: number
  seatsLimit: number
  status: TenantStatus
  appAccess: boolean
  dictionarySharing: boolean
  auditAccess: boolean
  historyAccess: boolean
  lastActivity: string
  notes: string
  modules: ModuleAccess[]
}

const initialTenants: CustomerTenant[] = [
  {
    id: "elevated-dynamics",
    name: "Elevated Dynamics",
    slug: "elevated-dynamics",
    owner: "Alex Morgan",
    email: "alex@elevateddynamics.com",
    plan: "Enterprise",
    seatsUsed: 42,
    seatsLimit: 50,
    status: "active",
    appAccess: true,
    dictionarySharing: true,
    auditAccess: true,
    historyAccess: true,
    lastActivity: "12 minutes ago",
    notes: "Primary production customer with audit and history enabled.",
    modules: [
      { key: "dictation", label: "Browser dictation", enabled: true },
      { key: "dictionary", label: "Shared dictionary", enabled: true },
      { key: "workflow", label: "Voice functions", enabled: true },
      { key: "email", label: "Email profiles", enabled: true },
      { key: "audit", label: "Audit log", enabled: true },
      { key: "devices", label: "Device sessions", enabled: true },
    ],
  },
  {
    id: "northwind-health",
    name: "Northwind Health",
    slug: "northwind-health",
    owner: "Dana Chen",
    email: "dana@northwindhealth.com",
    plan: "Growth",
    seatsUsed: 18,
    seatsLimit: 25,
    status: "trial",
    appAccess: true,
    dictionarySharing: true,
    auditAccess: false,
    historyAccess: true,
    lastActivity: "2 hours ago",
    notes: "Pilot group for clinical dictation and shared phrase templates.",
    modules: [
      { key: "dictation", label: "Browser dictation", enabled: true },
      { key: "dictionary", label: "Shared dictionary", enabled: true },
      { key: "workflow", label: "Voice functions", enabled: true },
      { key: "email", label: "Email profiles", enabled: false },
      { key: "audit", label: "Audit log", enabled: false },
      { key: "devices", label: "Device sessions", enabled: true },
    ],
  },
  {
    id: "harbor-finance",
    name: "Harbor Finance",
    slug: "harbor-finance",
    owner: "Maya Patel",
    email: "maya@harborfinance.com",
    plan: "Starter",
    seatsUsed: 7,
    seatsLimit: 10,
    status: "pending",
    appAccess: false,
    dictionarySharing: false,
    auditAccess: false,
    historyAccess: false,
    lastActivity: "Pending invite",
    notes: "Invite sent, waiting for billing approval before activation.",
    modules: [
      { key: "dictation", label: "Browser dictation", enabled: false },
      { key: "dictionary", label: "Shared dictionary", enabled: false },
      { key: "workflow", label: "Voice functions", enabled: false },
      { key: "email", label: "Email profiles", enabled: false },
      { key: "audit", label: "Audit log", enabled: false },
      { key: "devices", label: "Device sessions", enabled: false },
    ],
  },
  {
    id: "summit-law",
    name: "Summit Law Group",
    slug: "summit-law-group",
    owner: "Jordan Lee",
    email: "jordan@summitlaw.com",
    plan: "Enterprise",
    seatsUsed: 31,
    seatsLimit: 40,
    status: "suspended",
    appAccess: false,
    dictionarySharing: true,
    auditAccess: true,
    historyAccess: false,
    lastActivity: "5 days ago",
    notes: "Temporarily suspended for billing review.",
    modules: [
      { key: "dictation", label: "Browser dictation", enabled: false },
      { key: "dictionary", label: "Shared dictionary", enabled: true },
      { key: "workflow", label: "Voice functions", enabled: false },
      { key: "email", label: "Email profiles", enabled: false },
      { key: "audit", label: "Audit log", enabled: true },
      { key: "devices", label: "Device sessions", enabled: false },
    ],
  },
]

const statusStyles: Record<TenantStatus, string> = {
  active: "bg-emerald-400/15 text-emerald-200 border-emerald-400/30",
  trial: "bg-cyan-400/15 text-cyan-200 border-cyan-400/30",
  pending: "bg-amber-400/15 text-amber-200 border-amber-400/30",
  suspended: "bg-rose-400/15 text-rose-200 border-rose-400/30",
}

const statusLabels: Record<TenantStatus, string> = {
  active: "Active",
  trial: "Trial",
  pending: "Pending",
  suspended: "Suspended",
}

const planLabels: PlanName[] = ["Starter", "Growth", "Enterprise"]

const metricDefinitions: Array<{
  label: string
  description: string
  icon: LucideIcon
}> = [
  { label: "Active customers", description: "Currently enabled for app use", icon: Building2 },
  { label: "Pending invites", description: "Waiting for activation", icon: CircleAlert },
  { label: "Access restricted", description: "Accounts blocked from the app", icon: FolderLock },
  { label: "Permissioned admins", description: "Owners and tenant admins", icon: Users },
]

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function updateTenant(
  tenants: CustomerTenant[],
  id: string,
  updater: (tenant: CustomerTenant) => CustomerTenant
) {
  return tenants.map((tenant) => (tenant.id === id ? updater(tenant) : tenant))
}

export default function TenantAdminPage() {
  const [tenants, setTenants] = useState<CustomerTenant[]>(initialTenants)
  const [selectedTenantId, setSelectedTenantId] = useState(initialTenants[0]?.id ?? "")
  const [searchTerm, setSearchTerm] = useState("")
  const [newTenantName, setNewTenantName] = useState("")
  const [newTenantEmail, setNewTenantEmail] = useState("")
  const [newTenantPlan, setNewTenantPlan] = useState<PlanName>("Growth")
  const [newTenantNotes, setNewTenantNotes] = useState("")

  const filteredTenants = tenants.filter((tenant) => {
    const haystack = [tenant.name, tenant.owner, tenant.email, tenant.plan, tenant.status, tenant.slug]
      .join(" ")
      .toLowerCase()
    return haystack.includes(searchTerm.toLowerCase())
  })

  const selectedTenant =
    tenants.find((tenant) => tenant.id === selectedTenantId) ?? filteredTenants[0] ?? tenants[0]

  const activeCount = tenants.filter((tenant) => tenant.status === "active").length
  const restrictedCount = tenants.filter((tenant) => tenant.status === "suspended").length
  const pendingCount = tenants.filter((tenant) => tenant.status === "pending").length
  const seatsUsed = tenants.reduce((total, tenant) => total + tenant.seatsUsed, 0)
  const seatsLimit = tenants.reduce((total, tenant) => total + tenant.seatsLimit, 0)
  const overviewMetrics = [
    { ...metricDefinitions[0], value: String(activeCount) },
    { ...metricDefinitions[1], value: String(pendingCount) },
    { ...metricDefinitions[2], value: String(restrictedCount) },
    { ...metricDefinitions[3], value: `${seatsUsed}/${seatsLimit}` },
  ]

  const setSelectedTenant = (tenantId: string) => {
    setSelectedTenantId(tenantId)
  }

  const updateSelectedTenant = (updater: (tenant: CustomerTenant) => CustomerTenant) => {
    if (!selectedTenant) return
    setTenants((current) => updateTenant(current, selectedTenant.id, updater))
  }

  const createTenant = () => {
    const trimmedName = newTenantName.trim()
    const trimmedEmail = newTenantEmail.trim()

    if (!trimmedName || !trimmedEmail) return

    const slug = slugify(trimmedName) || `customer-${Date.now()}`
    const createdTenant: CustomerTenant = {
      id: slug,
      name: trimmedName,
      slug,
      owner: trimmedName,
      email: trimmedEmail,
      plan: newTenantPlan,
      seatsUsed: 0,
      seatsLimit: newTenantPlan === "Enterprise" ? 50 : newTenantPlan === "Growth" ? 25 : 10,
      status: "pending",
      appAccess: false,
      dictionarySharing: false,
      auditAccess: false,
      historyAccess: false,
      lastActivity: "Just created",
      notes: newTenantNotes.trim() || "New customer invite prepared from the admin console.",
      modules: [
        { key: "dictation", label: "Browser dictation", enabled: false },
        { key: "dictionary", label: "Shared dictionary", enabled: false },
        { key: "workflow", label: "Voice functions", enabled: false },
        { key: "email", label: "Email profiles", enabled: false },
        { key: "audit", label: "Audit log", enabled: false },
        { key: "devices", label: "Device sessions", enabled: false },
      ],
    }

    setTenants((current) => [createdTenant, ...current])
    setSelectedTenantId(createdTenant.id)
    setNewTenantName("")
    setNewTenantEmail("")
    setNewTenantPlan("Growth")
    setNewTenantNotes("")
  }

  return (
    <PageLayout
      title="Tenant Management"
      subtitle="Provision customers, assign plans, and control what each tenant can access in the app"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewMetrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="flex items-start justify-between gap-4 pt-6">
              <div className="space-y-2">
                <p className="text-sm text-slate-400">{metric.label}</p>
                <p className="text-3xl font-semibold tracking-tight text-white">{metric.value}</p>
                <p className="text-sm text-slate-400">{metric.description}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-400/25">
                <metric.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle>Customer registry</CardTitle>
                <CardDescription>Search tenants, review status, and select a customer to edit access.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="compact">
                  Export CSV
                </Button>
                <Button size="compact">Sync access</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by customer, owner, plan, or status"
                  className="pl-9"
                />
              </div>
              <Badge variant="outline" className="justify-center">
                {filteredTenants.length} matching tenants
              </Badge>
            </div>

            <div className="space-y-3">
              {filteredTenants.map((tenant) => {
                const active = tenant.id === selectedTenant?.id

                return (
                  <article
                    key={tenant.id}
                    className={cn(
                      "rounded-2xl border p-4 transition-colors",
                      active ? "border-cyan-400/30 bg-cyan-400/10" : "border-white/10 bg-white/5"
                    )}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-white">{tenant.name}</h3>
                          <Badge className={statusStyles[tenant.status]} variant="outline">
                            {statusLabels[tenant.status]}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-400">
                          {tenant.owner} - {tenant.email}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{tenant.plan}</Badge>
                          <Badge variant="outline">
                            {tenant.seatsUsed}/{tenant.seatsLimit} seats
                          </Badge>
                          <Badge variant={tenant.appAccess ? "success" : "outline"}>
                            {tenant.appAccess ? "App on" : "App off"}
                          </Badge>
                          <Badge variant={tenant.dictionarySharing ? "success" : "outline"}>
                            Dictionary {tenant.dictionarySharing ? "on" : "off"}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                        <Button
                          aria-pressed={active}
                          className="w-full sm:w-auto"
                          onClick={() => setSelectedTenant(tenant.id)}
                          size="compact"
                          variant={active ? "default" : "outline"}
                        >
                          {active ? "Selected" : "Select"}
                        </Button>
                        <p className="text-xs text-slate-500">Last activity {tenant.lastActivity}</p>
                      </div>
                    </div>
                  </article>
                )
              })}
              {!filteredTenants.length ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-400">
                  No customers match the current search.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Customer access</CardTitle>
                  <CardDescription>Adjust the selected tenant without leaving the page.</CardDescription>
                </div>
                <Badge variant="outline">Selected tenant</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedTenant ? (
                <>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-white">{selectedTenant.name}</p>
                        <p className="text-sm text-slate-400">{selectedTenant.email}</p>
                      </div>
                      <Badge className={statusStyles[selectedTenant.status]} variant="outline">
                        {statusLabels[selectedTenant.status]}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">{selectedTenant.notes}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge variant="outline">{selectedTenant.seatsUsed}/{selectedTenant.seatsLimit} seats</Badge>
                      <Badge variant={selectedTenant.appAccess ? "success" : "outline"}>
                        App {selectedTenant.appAccess ? "enabled" : "disabled"}
                      </Badge>
                      <Badge variant={selectedTenant.historyAccess ? "success" : "outline"}>
                        History {selectedTenant.historyAccess ? "enabled" : "disabled"}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Plan</label>
                      <Select
                        value={selectedTenant.plan}
                        onValueChange={(value) =>
                          updateSelectedTenant((tenant) => ({
                            ...tenant,
                            plan: value as PlanName,
                            seatsLimit: value === "Enterprise" ? 50 : value === "Growth" ? 25 : 10,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select plan" />
                        </SelectTrigger>
                        <SelectContent>
                          {planLabels.map((plan) => (
                            <SelectItem key={plan} value={plan}>
                              {plan}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Status</label>
                      <Select
                        value={selectedTenant.status}
                        onValueChange={(value) =>
                          updateSelectedTenant((tenant) => ({
                            ...tenant,
                            status: value as TenantStatus,
                            appAccess: value === "active" || value === "trial",
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(statusLabels) as TenantStatus[]).map((status) => (
                            <SelectItem key={status} value={status}>
                              {statusLabels[status]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      className="w-full"
                      variant={selectedTenant.appAccess ? "default" : "outline"}
                      size="compact"
                      onClick={() =>
                        updateSelectedTenant((tenant) => ({
                          ...tenant,
                          appAccess: !tenant.appAccess,
                          status: !tenant.appAccess ? "active" : tenant.status === "active" ? "suspended" : tenant.status,
                        }))
                      }
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {selectedTenant.appAccess ? "App access enabled" : "Enable app access"}
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      size="compact"
                      onClick={() =>
                        updateSelectedTenant((tenant) => ({
                          ...tenant,
                          status: tenant.status === "suspended" ? "active" : "suspended",
                          appAccess: tenant.status === "suspended",
                        }))
                      }
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {selectedTenant.status === "suspended" ? "Restore tenant" : "Suspend tenant"}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-slate-400">
                  Select a customer from the registry to edit access.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>App modules</CardTitle>
              <CardDescription>Control which parts of the product the tenant can see.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedTenant?.modules.map((module) => (
                <Button
                  key={module.key}
                  type="button"
                  variant={module.enabled ? "default" : "outline"}
                  className="w-full justify-between"
                  size="compact"
                  aria-pressed={module.enabled}
                  onClick={() =>
                    updateSelectedTenant((tenant) => ({
                      ...tenant,
                      modules: tenant.modules.map((item) =>
                        item.key === module.key ? { ...item, enabled: !item.enabled } : item
                      ),
                    }))
                  }
                >
                  <span className="flex items-center gap-2">
                    <Workflow className="h-4 w-4" />
                    {module.label}
                  </span>
                  <span className="text-xs uppercase tracking-[0.25em]">
                    {module.enabled ? "On" : "Off"}
                  </span>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create customer</CardTitle>
            <CardDescription>Prepare a new tenant invite and initial access defaults.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Customer name</label>
                <Input
                  value={newTenantName}
                  onChange={(event) => setNewTenantName(event.target.value)}
                  placeholder="Customer name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Admin email</label>
                <Input
                  value={newTenantEmail}
                  onChange={(event) => setNewTenantEmail(event.target.value)}
                  placeholder="Admin email"
                  type="email"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Plan</label>
                <Select value={newTenantPlan} onValueChange={(value) => setNewTenantPlan(value as PlanName)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {planLabels.map((plan) => (
                      <SelectItem key={plan} value={plan}>
                        {plan}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Invite tools</label>
                <Button variant="outline" className="w-full justify-start" type="button" size="compact">
                  <KeyRound className="h-4 w-4" />
                  Generate invite link
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Notes</label>
              <Textarea
                value={newTenantNotes}
                onChange={(event) => setNewTenantNotes(event.target.value)}
                placeholder="Optional note for internal provisioning, billing, or support."
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={createTenant} size="compact">
                <SquarePen className="h-4 w-4" />
                Create customer
              </Button>
              <Button
                variant="outline"
                size="compact"
                onClick={() => {
                  setNewTenantName("")
                  setNewTenantEmail("")
                  setNewTenantPlan("Growth")
                  setNewTenantNotes("")
                }}
              >
                Reset form
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tenant policy</CardTitle>
            <CardDescription>Defaults that determine how new customers are provisioned.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <span>App access defaults to off for new tenants</span>
              <Badge variant="warning">Manual approval</Badge>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <span>Dictionary sharing is tenant-controlled</span>
              <Badge variant="outline">Policy enforced</Badge>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <span>Audit visibility follows tenant role permissions</span>
              <Badge variant="outline">RBAC aware</Badge>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <span>History retention is set per tenant</span>
              <Badge variant="success">30-day default</Badge>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-400">
              The condensed control layout keeps the important actions visible while preserving the minimum touch
              target and focus visibility required for accessibility.
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}
