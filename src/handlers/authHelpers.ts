// src/handlers/authHelpers.ts
import type { Request } from "express";
import { updateGatewayContext } from "@gatewaystack/request-context";
import { REQUIRED_SCOPES, TOOL_SCOPES } from "../tools/tools";
import { identifiablVerifier } from "../gateway/toolGateway";
import { OAUTH_SCOPES, OAUTH_AUDIENCE } from "./oauthConfig";

// ----------------- Small helpers -----------------
export function readAuth(req: Request) {
  const auth = req.header("authorization") || "";
  const hasAuth = auth.startsWith("Bearer ");
  const token = hasAuth ? auth.slice(7) : "";
  const tokenShape = token.includes(".") ? "jwt" : (token ? "opaque" : "none");
  return { hasAuth, token, tokenShape, len: token.length };
}

export function logAuthShape(prefix: string, req: Request) {
  const { hasAuth, tokenShape, len } = readAuth(req);
  console.log(
    `[auth:${prefix}] hasAuth=%s tokenShape=%s len=%d path=%s method=%s`,
    hasAuth,
    tokenShape,
    len,
    (req as any).path ?? req.url,
    req.method
  );
}

export function logTokenScopes(prefix: string, payload: any) {
  const scopeStr = typeof payload.scope === "string" ? payload.scope : "";
  const permissions = Array.isArray((payload as any).permissions)
    ? (payload as any).permissions
    : [];
  const scopes = Array.from(
    new Set([
      ...scopeStr.split(" ").filter(Boolean),
      ...permissions,
    ])
  );

  console.log(`[auth:${prefix}]`, { scopeStr, permissions, scopes });
}

export function b64urlDecodeToJson(s: string) {
  try {
    s += "=".repeat((4 - (s.length % 4)) % 4);
    const buf = Buffer.from(
      s.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    );
    return JSON.parse(buf.toString("utf8"));
  } catch {
    return undefined;
  }
}

export function requireScopes(have: string[], need: string[]) {
  const ok = need.every((s) => have.includes(s));
  if (!ok) {
    console.warn("[auth:insufficient_scope]", { have, need });
    const err: any = new Error("insufficient_scope");
    err.status = 403;
    err.code = "INSUFFICIENT_SCOPE";
    throw err;
  }
}

export async function subjectToUid(sub: string, _email?: string): Promise<string> {
  return `auth0:${sub}`;
}

// ----------------- WWW-Authenticate builder -----------------
export function buildWwwAuthenticate(req: Request): string {
  const xfProto = req.get("x-forwarded-proto") || (req as any).protocol || "https";
  const xfHost = req.get("x-forwarded-host") || req.get("host");
  const base = `${xfProto}://${xfHost}`;

  const metaUrl = `${base}/.well-known/oauth-protected-resource`;

  const scopeParam = (
    REQUIRED_SCOPES.length
      ? REQUIRED_SCOPES
      : OAUTH_SCOPES.split(" ").filter(Boolean)
  ).join(" ");

  const resourceParam = OAUTH_AUDIENCE ? `, resource="${OAUTH_AUDIENCE}"` : "";

  return `Bearer resource_metadata="${metaUrl}", scope="${scopeParam}"${resourceParam}`;
}

// ----------------- Core verify helpers -----------------
export async function verifyBearer(req: Request) {
  logAuthShape("verifyBearer", req);

  const auth = req.header("authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    const err: any = new Error("NO_AUTH");
    err.status = 401;
    err.www = buildWwwAuthenticate(req) + ', error="invalid_token"';
    throw err;
  }

  const accessToken = auth.slice(7);

  const segments = accessToken.split(".");
  const header = segments[0] ? b64urlDecodeToJson(segments[0]) : undefined;
  console.log(
    "[auth:token] segments=%d header.alg=%s header.typ=%s",
    segments.length,
    header?.alg,
    header?.typ
  );

  if (segments.length !== 3) {
    const e: any = new Error(
      segments.length === 5
        ? "ACCESS_TOKEN_IS_ENCRYPTED_JWE"
        : "ACCESS_TOKEN_NOT_JWS"
    );
    e.status = 401;
    e.www = buildWwwAuthenticate(req) + ', error="invalid_token"';
    throw e;
  }

  const result = await identifiablVerifier(accessToken);

  if (!result.ok) {
    console.error("[auth:identifiabl:error]", {
      error: result.error,
      detail: result.detail,
    });
    const e: any = new Error("JWT_VERIFY_FAILED");
    e.status = 401;
    e.www = buildWwwAuthenticate(req) + ', error="invalid_token"';
    throw e;
  }

  const { identity, payload } = result;

  console.log("[auth:postVerify]", {
    sub: identity.sub,
    issuer: identity.issuer,
    tenantId: identity.tenantId,
    roles: identity.roles,
    scopes: identity.scopes,
    plan: identity.plan,
    source: identity.source,
  });

  updateGatewayContext({
    identity: {
      ...identity,
      raw: identity.raw ?? payload,
    },
  });

  logTokenScopes("postVerify", payload as any);

  return payload;
}

export async function verifyBearerAndScopes(req: Request, toolName: string) {
  const payload = await verifyBearer(req);

  const sub = String(payload.sub || "");
  if (!sub) {
    const err: any = new Error("TOKEN_NO_SUB");
    err.status = 401;
    err.www = buildWwwAuthenticate(req) + ', error="invalid_token"';
    throw err;
  }

  const email =
    typeof (payload as any).email === "string"
      ? ((payload as any).email as string)
      : undefined;

  const scopeStr =
    typeof (payload as any).scope === "string"
      ? ((payload as any).scope as string)
      : "";
  const permissions = Array.isArray((payload as any).permissions)
    ? ((payload as any).permissions as string[])
    : [];

  const scopes = Array.from(
    new Set([
      ...scopeStr.split(" ").filter(Boolean),
      ...permissions,
    ])
  );

  const need = TOOL_SCOPES[toolName] || [];
  if (need.length) requireScopes(scopes, need);

  const uid = await subjectToUid(sub, email);
  return { uid, scopes, payload };
}
