import type { NextFunction, Request, Response } from "express"
import jwt from "jsonwebtoken"

import { config } from "./config"
import { rolePermissionMap } from "./constants"
import { state } from "./store"
import type { Permission, RoleName } from "./constants"
import type { SessionContext } from "./types"

export type AuthedRequest = Request & {
  auth?: SessionContext
  tenantId?: string
  userRole?: RoleName
  permissions?: Permission[]
}

export function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" })
  }

  try {
    const token = header.slice("Bearer ".length)
    const payload = jwt.verify(token, config.jwtAccessSecret) as SessionContext
    req.auth = payload
    next()
  } catch {
    return res.status(401).json({ error: "Invalid access token" })
  }
}

export function tenantContextMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthenticated request" })
  }

  const requestedTenantId =
    (req.params.tenantId as string | undefined) ||
    (req.headers["x-tenant-id"] as string | undefined) ||
    req.auth.activeTenantId
  if (!requestedTenantId) {
    return res.status(400).json({ error: "Tenant context is required" })
  }

  const membership = state.memberships.find(
    (item) => item.userId === req.auth?.userId && item.tenantId === requestedTenantId && item.active
  )

  if (!membership) {
    return res.status(403).json({ error: "You do not belong to the active tenant" })
  }

  req.tenantId = requestedTenantId
  req.userRole = membership.role as RoleName
  req.permissions = rolePermissionMap[membership.role as RoleName]
  next()
}

export function requirePermission(permission: Permission) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.permissions?.includes(permission)) {
      return res.status(403).json({ error: `Missing permission: ${permission}` })
    }
    next()
  }
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  const message = error instanceof Error ? error.message : "Unexpected server error"
  res.status(500).json({ error: message })
}
