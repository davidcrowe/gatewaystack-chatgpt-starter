import type { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

// Read at runtime (not module init) so Cloud Run config changes don’t require rebuilds
function getOauthConfig() {
  // NOTE: don't trim the issuer here during diagnosis; strict match matters.
  // If you want normalization later, do it knowingly once you see token.iss.
  const OAUTH_ISSUER = (process.env.OAUTH_ISSUER ?? "").trim();
  const OAUTH_AUDIENCE = (process.env.OAUTH_AUDIENCE ?? "").trim();

  // If issuer ends without "/", prefer to add it when constructing JWKS URI
  // (Auth0 issuer often ends with "/").
  const issuerForJwks = OAUTH_ISSUER ? OAUTH_ISSUER.replace(/\/+$/, "") : "";
  const JWKS_URI =
    (process.env.JWKS_URI ?? "").trim() ||
    (issuerForJwks ? `${issuerForJwks}/.well-known/jwks.json` : "");

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
    payload: Record<string, any>;
    source?: "gateway" | "jwt";
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
 *
 * NOTE: In your current architecture Proxyabl performs an HTTP self-call to /demo/*,
 * so res.locals from the gateway does NOT carry across. This means the fallback JWT
 * verification path will run for /demo calls, and issuer/audience must match the token.
 */
export async function requireJwt(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    // Preferred path (only works if /demo is invoked in-process, not via HTTP hop)
    const gw = (res as any).locals?.gatewayContext?.identity || (res as any).locals?.gatewayAuth;
    if (gw?.sub) {
      req.auth = {
        sub: String(gw.sub),
        scope: typeof gw.scope === "string" ? gw.scope : undefined,
        permissions: Array.isArray(gw.permissions) ? gw.permissions : undefined,
        payload: {
          // Minimal SAFE claim set for demo display purposes
          sub: gw.sub,
          scope: gw.scope,
          permissions: gw.permissions,
          iss: gw.iss,
          aud: gw.aud,
          exp: gw.exp,
          iat: gw.iat,
          email: gw.email,
          name: gw.name,
          azp: gw.azp,
          client_id: gw.client_id,
          gty: gw.gty,
        },
        source: "gateway",
      };
      return next();
    }

    // Fallback: verify JWT (direct access to /demo, or HTTP self-call)
    const token = asBearer(req);
    if (!token) return res.status(401).json({ ok: false, error: "missing_bearer" });

    const { OAUTH_ISSUER, OAUTH_AUDIENCE, JWKS_URI } = getOauthConfig();

    // Log what this revision believes the config is (helps catch "wrong revision/env" issues)
    console.log("[demo-api:jwt] expected", {
      issuer: OAUTH_ISSUER,
      audience: OAUTH_AUDIENCE,
      jwksUri: JWKS_URI,
    });

    if (!OAUTH_ISSUER) console.warn("[demo-api] OAUTH_ISSUER is not set");
    if (!OAUTH_AUDIENCE) console.warn("[demo-api] OAUTH_AUDIENCE is not set");
    if (!JWKS_URI) console.warn("[demo-api] JWKS_URI is not set");

    const jwks = getJwks(JWKS_URI);
    if (!jwks) return res.status(500).json({ ok: false, error: "jwks_not_configured" });

    const { payload } = await jwtVerify(token, jwks, {
      issuer: OAUTH_ISSUER,     // keep strict trust chain
      audience: OAUTH_AUDIENCE, // keep strict trust chain
    });

    const sub = String((payload as any).sub || "");
    if (!sub) return res.status(401).json({ ok: false, error: "token_missing_sub" });

    req.auth = {
      sub,
      scope: typeof (payload as any).scope === "string" ? (payload as any).scope : undefined,
      permissions: Array.isArray((payload as any).permissions)
        ? ((payload as any).permissions as string[])
        : undefined,
      payload: payload as any,
      source: "jwt",
    };

    return next();
  } catch (e: any) {
    // Diagnostic: decode claims WITHOUT logging the token
    // This does not weaken validation; it's just to discover the exact iss/aud strings.
    try {
      const token = asBearer(req);
      if (token) {
        const [, p] = token.split(".");
        if (p) {
          const payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
          console.warn("[demo-api:jwt] token claims (debug)", {
            iss: payload?.iss,
            aud: payload?.aud,
          });
        }
      }
    } catch {
      // ignore debug decode failures
    }

    console.warn("[demo-api] jwt verify failed", { message: e?.message || String(e) });
    return res.status(401).json({ ok: false, error: "invalid_token" });
  }
}