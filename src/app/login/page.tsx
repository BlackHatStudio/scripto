"use client"

import Link from "next/link"
import type { FormEvent } from "react"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Apple, Mail, LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  apiBaseUrl,
  apiFetch,
  hasStoredSession,
  setSession,
  rememberCredentials,
  getRememberedCredentials,
} from "@/lib/api"

type LoginResponse = {
  accessToken: string
  refreshToken: string
  activeTenantId: string | null
}

export default function LoginPage() {
  const router = useRouter()
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rememberMe, setRememberMe] = useState(true)
  const autoLoginAttempted = useRef(false)

  useEffect(() => {
    if (hasStoredSession()) {
      router.replace("/dashboard")
      return
    }

    if (autoLoginAttempted.current) return
    const remembered = getRememberedCredentials()
    if (remembered) {
      autoLoginAttempted.current = true
      if (emailRef.current) emailRef.current.value = remembered.email
      void submit({ email: remembered.email, password: remembered.password, remember: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  async function submit(override?: { email?: string; password?: string; remember?: boolean }) {
    const nextEmail = (override?.email ?? emailRef.current?.value ?? "").trim().toLowerCase()
    const nextPassword = override?.password ?? passwordRef.current?.value ?? ""
    const shouldRemember = override?.remember ?? rememberMe
    setLoading(true)
    setError(null)
    try {
      const response = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: nextEmail, password: nextPassword }),
      })
      setSession(response)
      if (shouldRemember) {
        rememberCredentials(nextEmail, nextPassword)
      }
      router.push("/dashboard")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await submit()
  }

  async function signInAsDemo() {
    if (emailRef.current) {
      emailRef.current.value = "demo@elevateddynamics.com"
    }
    if (passwordRef.current) {
      passwordRef.current.value = "Password123!"
    }
    await submit({
      email: "demo@elevateddynamics.com",
      password: "Password123!",
    })
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-6 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.08),_transparent_24%)]" />
      <div className="relative mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <section className="space-y-6 text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 shadow-[0_0_40px_rgba(34,211,238,0.12)]">
            <Mail className="h-4 w-4" />
            Secure access
          </div>
          <div className="space-y-4">
            <h1 className="max-w-xl text-5xl font-semibold tracking-tight text-white md:text-6xl">
              Sign in to your dictation workspace.
            </h1>
            <p className="max-w-xl text-lg leading-8 text-slate-300">
              Resume the active tenant, keep dictionaries in sync, and return to correction workflows without friction.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "Tenant-aware sessions",
              "Browser dictation",
              "Dictionary sync",
              "Audit-ready access",
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
          <CardTitle className="text-3xl">Sign in</CardTitle>
          <CardDescription>Access your tenant-aware dictation workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm text-slate-300" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                name="username"
                type="email"
                ref={emailRef}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-300" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                ref={passwordRef}
                autoComplete="current-password"
                required
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-transparent"
              />
              Remember me and sign in automatically next time
            </label>
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Sign in
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => void signInAsDemo()}
                disabled={loading}
              >
                Use demo account
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Demo login: <span className="text-slate-300">demo@elevateddynamics.com</span> /{" "}
              <span className="text-slate-300">Password123!</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => (window.location.href = `${apiBaseUrl()}/auth/oauth/google`)}
              >
                Continue with Google
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => (window.location.href = `${apiBaseUrl()}/auth/oauth/apple`)}
              >
                <Apple className="h-4 w-4" />
                Continue with Apple
              </Button>
            </div>
            <p className="text-sm text-slate-400">
              New workspace? <Link href="/signup" className="text-cyan-200">Create an account</Link>
            </p>
          </form>
        </CardContent>
      </Card>
      </div>
    </main>
  )
}
