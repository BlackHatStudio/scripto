"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { LoaderCircle, UserPlus2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { apiFetch, setSession } from "@/lib/api"

type SignupResponse = {
  accessToken: string
  refreshToken: string
  activeTenantId: string | null
}

export default function SignupPage() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState("Alex Morgan")
  const [email, setEmail] = useState("alex@elevateddynamics.com")
  const [password, setPassword] = useState("Password123!")
  const [tenantName, setTenantName] = useState("Elevated Dynamics")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setLoading(true)
    setError(null)
    try {
      const response = await apiFetch<SignupResponse>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ displayName, email, password, tenantName }),
      })
      setSession(response)
      router.push("/dashboard")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Signup failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-6 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.08),_transparent_24%)]" />
      <div className="relative mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <section className="space-y-6 text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 shadow-[0_0_40px_rgba(34,211,238,0.12)]">
            <UserPlus2 className="h-4 w-4" />
            New workspace setup
          </div>
          <div className="space-y-4">
            <h1 className="max-w-xl text-5xl font-semibold tracking-tight text-white md:text-6xl">
              Create a workspace with clean tenant boundaries.
            </h1>
            <p className="max-w-xl text-lg leading-8 text-slate-300">
              Set up a tenant, owner account, and the first correction environment in one pass.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "Owner-first setup",
              "RBAC ready",
              "Shared dictionaries",
              "Audit logging enabled",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </section>

        <Card className="w-full border-white/10 bg-slate-950/80">
        <CardHeader>
          <div className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Scripto</div>
          <CardTitle className="text-3xl">Create account</CardTitle>
          <CardDescription>
            Sign up and create the first tenant with the TenantOwner role.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="displayName">
              Name
            </label>
            <Input id="displayName" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="tenantName">
              Tenant name
            </label>
            <Input id="tenantName" value={tenantName} onChange={(event) => setTenantName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="email">
              Email
            </label>
            <Input id="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <Button className="w-full" onClick={submit} disabled={loading}>
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus2 className="h-4 w-4" />}
            Create tenant and account
          </Button>
          <p className="text-sm text-slate-400">
            Already have a workspace? <Link href="/login" className="text-cyan-200">Sign in</Link>
          </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
