import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2"
import jwt from "jsonwebtoken"

import { config } from "../config"
import { createId, addRefreshSession, state, revokeRefreshSession } from "../store"
import type { SessionContext, UserRecord } from "../types"

export async function hashPassword(password: string) {
  return argon2Hash(password)
}

export async function verifyPassword(hash: string, password: string) {
  try {
    return await argon2Verify(hash, password)
  } catch {
    return false
  }
}

export function createAccessToken(user: UserRecord) {
  const payload: SessionContext = {
    userId: user.id,
    activeTenantId: user.activeTenantId,
    email: user.email,
  }
  return jwt.sign(payload, config.jwtAccessSecret, { expiresIn: "15m" })
}

export async function createRefreshToken(userId: string, tenantId: string | null) {
  const token = jwt.sign(
    { sub: userId, tenantId, jti: createId() },
    config.jwtRefreshSecret,
    { expiresIn: "30d" }
  )
  const tokenHash = await argon2Hash(token)
  const session = addRefreshSession({
    userId,
    tenantId,
    deviceId: createId(),
    tokenHash,
    userAgent: null,
    ipAddress: null,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  })
  return { token, session }
}

export async function rotateRefreshToken(token: string) {
  const decoded = jwt.verify(token, config.jwtRefreshSecret) as { sub: string; tenantId: string | null }
  const session = await findRefreshSession(token)
  if (!session) {
    throw new Error("Refresh token revoked or not found")
  }
  revokeRefreshSession(session.id)

  const next = await createRefreshToken(decoded.sub, decoded.tenantId)
  return { userId: decoded.sub, tenantId: decoded.tenantId, next, session }
}

export async function compareRefreshToken(token: string) {
  const decoded = jwt.verify(token, config.jwtRefreshSecret) as { sub: string; tenantId: string | null }
  return decoded
}

export async function revokeRefreshToken(token: string) {
  const session = await findRefreshSession(token)
  if (session) {
    revokeRefreshSession(session.id)
  }
  return session
}

async function findRefreshSession(token: string) {
  for (const session of state.refreshSessions) {
    if (session.revokedAt) continue
    if (await argon2Verify(session.tokenHash, token)) {
      return session
    }
  }
  return null
}
