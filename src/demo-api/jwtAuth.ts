import type { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

// Read at runtime (not module init) so Cloud Run config changes don’t require rebuilds
function getOauthConfig() {
  const OAUTH_ISSUER = (process.env.OAUTH_ISSUER ?? "").replace(/\/+$/, "");
  const OAUTH_AUDIENCE = process.env.OAUTH_AUDIENCE ?? "";
  const JWKS_URI =
    process.env.JWKS_URI ?? (OAUTH_ISSUER ? `${OAUTH_ISSUER}/.well-known/jwks.json` : "");

  return { OAUTH_ISSUER, OAUTH_AUDIENCE, JWKS_URI };
}

// Lazily created JWKS; keyed by JWKS_URI
let jwksCache: { uri: string; jwks: ReturnType<typeof createRemoteJWKSet> } | null = null;

function getJwks(jwksUri: string) {
  if (!jwksUri) return null;
  if (jwksCache?.uri === jwksUri) return jwksCache.jwks;
  jwksCache = { uri: jwksUri, jwks: createRemoteJWKSet(new URL(jwksUri)) };
  return jwksCache.jwks;
}

export type AuthedRequest = Request & {
  auth?: {
    sub: string;
    scope?: string;
    permissions?: string[];
    payload: any;
  };
};

function asBearer(req: Request): string | null {
  const h = req.header("authorization") || "";
  if (!h.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

/**
 * If the gateway already authenticated the request, trust that (same-service call).
 * Otherwise, verify JWT directly (useful when calling /demo directly).
 */
export async function requireJwt(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    // ✅ Preferred path: gateway-authenticated context
    const gw = (res as any).locals?.gatewayContext?.identity || (res as any).locals?.gatewayAuth;
    if (gw?.sub) {
      req.auth = {
        sub: String(gw.sub),
        scope: typeof gw.scope === "string" ? gw.scope : undefined,
        permissions: Array.isArray(gw.permissions) ? gw.permissions : undefined,
        payload: { sub: gw.sub, scope: gw.scope, permissions: gw.permissions, _source: "gateway" },
      };
      return next();
    }

    // Fallback: verify JWT (direct access to /demo)
    const token = asBearer(req);
    if (!token) return res.status(401).json({ ok: false, error: "missing_bearer" });

    const { OAUTH_ISSUER, OAUTH_AUDIENCE, JWKS_URI } = getOauthConfig();
    if (!OAUTH_ISSUER) console.warn("[demo-api] OAUTH_ISSUER is not set");
    if (!OAUTH_AUDIENCE) console.warn("[demo-api] OAUTH_AUDIENCE is not set");
    if (!JWKS_URI) console.warn("[demo-api] JWKS_URI is not set");

    const jwks = getJwks(JWKS_URI);
    if (!jwks) return res.status(500).json({ ok: false, error: "jwks_not_configured" });

    const { payload } = await jwtVerify(token, jwks, {
      issuer: OAUTH_ISSUER,
      audience: OAUTH_AUDIENCE,
    });

    const sub = String(payload.sub || "");
    if (!sub) return res.status(401).json({ ok: false, error: "token_missing_sub" });

    req.auth = {
      sub,
      scope: typeof (payload as any).scope === "string" ? (payload as any).scope : undefined,
      permissions: Array.isArray((payload as any).permissions)
        ? ((payload as any).permissions as string[])
        : undefined,
      payload,
    };

    return next();
  } catch (e: any) {
    console.warn("[demo-api] jwt verify failed", { message: e?.message || String(e) });
    return res.status(401).json({ ok: false, error: "invalid_token" });
  }
}