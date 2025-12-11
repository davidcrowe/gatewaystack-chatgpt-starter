import type { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

const OAUTH_ISSUER = (process.env.OAUTH_ISSUER ?? "").replace(/\/+$/, "");
const OAUTH_AUDIENCE = process.env.OAUTH_AUDIENCE ?? "";
const JWKS_URI =
  process.env.JWKS_URI ?? (OAUTH_ISSUER ? `${OAUTH_ISSUER}/.well-known/jwks.json` : "");

if (!OAUTH_ISSUER) console.warn("[demo-api] OAUTH_ISSUER is not set");
if (!OAUTH_AUDIENCE) console.warn("[demo-api] OAUTH_AUDIENCE is not set");
if (!JWKS_URI) console.warn("[demo-api] JWKS_URI is not set");

const jwks = JWKS_URI ? createRemoteJWKSet(new URL(JWKS_URI)) : null;

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

export async function requireJwt(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const token = asBearer(req);
    if (!token) return res.status(401).json({ ok: false, error: "missing_bearer" });
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

    next();
  } catch (e: any) {
    console.warn("[demo-api] jwt verify failed", { message: e?.message || String(e) });
    return res.status(401).json({ ok: false, error: "invalid_token" });
  }
}
