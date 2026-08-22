const FALLBACK_API_BASE_URL = "http://localhost:4445/api"
const AUTH_ENDPOINTS = ["/auth/login", "/auth/signup", "/auth/refresh"]
const ACCESS_TOKEN_REFRESH_SKEW_MS = 30_000

export function apiBaseUrl() {
  if (typeof window !== "undefined") {
    const apiHost = window.location.hostname === "0.0.0.0" ? "127.0.0.1" : window.location.hostname
    return `${window.location.protocol}//${apiHost}:4445/api`
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL || FALLBACK_API_BASE_URL
}

export function getAccessToken() {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem("speechflow.accessToken")
}

export function hasStoredSession() {
  if (typeof window === "undefined") return false
  return Boolean(window.localStorage.getItem("speechflow.accessToken") || window.localStorage.getItem("speechflow.refreshToken"))
}

export function setSession(tokens: {
  accessToken: string
  refreshToken: string
  activeTenantId: string | null
}) {
  window.localStorage.setItem("speechflow.accessToken", tokens.accessToken)
  window.localStorage.setItem("speechflow.refreshToken", tokens.refreshToken)
  if (tokens.activeTenantId) {
    window.localStorage.setItem("speechflow.activeTenantId", tokens.activeTenantId)
  }
}

export function clearSession() {
  window.localStorage.removeItem("speechflow.accessToken")
  window.localStorage.removeItem("speechflow.refreshToken")
  window.localStorage.removeItem("speechflow.activeTenantId")
}

// "Remember me" - lets the desktop app auto-sign-in on startup even if the
// session token itself was cleared or invalidated (e.g. after a backend
// secret rotation). Local-machine-only storage, consistent with the trust
// model already used for locally-generated JWT secrets.
export function rememberCredentials(email: string, password: string) {
  window.localStorage.setItem("speechflow.rememberedCredentials", JSON.stringify({ email, password }))
}

export function getRememberedCredentials(): { email: string; password: string } | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem("speechflow.rememberedCredentials")
  if (!raw) return null
  try {
    return JSON.parse(raw) as { email: string; password: string }
  } catch {
    return null
  }
}

export function forgetCredentials() {
  window.localStorage.removeItem("speechflow.rememberedCredentials")
}

function getRefreshToken() {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem("speechflow.refreshToken")
}

function getAccessTokenExpiration(token: string) {
  try {
    const payload = token.split(".")[1]
    if (!payload) return null

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
    const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="))
    const parsed = JSON.parse(decoded) as { exp?: number }
    return typeof parsed.exp === "number" ? parsed.exp * 1000 : null
  } catch {
    return null
  }
}

async function ensureFreshAccessToken() {
  const token = getAccessToken()
  if (!token) {
    return refreshSession()
  }

  const expiresAt = getAccessTokenExpiration(token)
  if (!expiresAt) {
    return refreshSession()
  }

  if (expiresAt - Date.now() <= ACCESS_TOKEN_REFRESH_SKEW_MS) {
    return refreshSession()
  }

  return true
}

async function refreshSession() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    return false
  }

  const response = await fetch(`${apiBaseUrl()}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ refreshToken }),
  })

  if (!response.ok) {
    clearSession()
    return false
  }

  const tokens = (await response.json()) as {
    accessToken: string
    refreshToken: string
    activeTenantId: string | null
  }
  setSession(tokens)
  return true
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retryOnAuthFailure = true
): Promise<T> {
  if (!AUTH_ENDPOINTS.includes(path)) {
    const sessionReady = await ensureFreshAccessToken()
    if (!sessionReady && typeof window !== "undefined") {
      clearSession()
      window.location.assign("/login")
      throw new Error("Authentication required")
    }
  }

  const headers = new Headers(init.headers)
  headers.set("Content-Type", "application/json")

  const token = getAccessToken()
  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers,
    credentials: "include",
  })

  if (response.status === 401 && retryOnAuthFailure && !AUTH_ENDPOINTS.includes(path)) {
    const refreshed = await refreshSession()
    if (refreshed) {
      return apiFetch<T>(path, init, false)
    }

    if (typeof window !== "undefined") {
      clearSession()
      window.location.assign("/login")
    }
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error || `Request failed with ${response.status}`)
  }

  return response.json() as Promise<T>
}
