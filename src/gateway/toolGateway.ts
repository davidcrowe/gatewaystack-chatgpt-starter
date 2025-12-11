// src/gateway/toolGateway.ts
import type { Request, Response } from "express";
import { randomUUID } from "crypto";

import { createIdentifiablVerifier } from "@gatewaystack/identifiabl";
import {
  configFromEnv as proxyablConfigFromEnv,
  createProxyablClient,
} from "@gatewaystack/proxyabl";
import {
  createConsoleLogger,
  explicablLoggingMiddleware,
} from "@gatewaystack/explicabl";

import { looksLikeJsonRpc, handleMcp } from "../handlers/mcpHandler";
import {
  verifyBearer,
  verifyBearerAndScopes,
  buildWwwAuthenticate,
} from "../handlers/authHelpers";
import { wellKnownOauthProtectedResourcev2 } from "../handlers/wellKnown";
import {
  setCorsHeaders,
  toolNameFromPath,
  fetchJsonWithRetry,
} from "../handlers/httpHelpers";
import {
  OAUTH_ISSUER,
  OAUTH_AUDIENCE,
  OAUTH_SCOPES,
  JWKS_URI_FALLBACK,
  OIDC_DISCOVERY,
} from "../handlers/oauthConfig";

console.log("[toolGatewayHandler] module loaded");

export { OAUTH_ISSUER, OAUTH_AUDIENCE, OAUTH_SCOPES };

// ---------- Proxyabl config ----------
const proxyablConfig = proxyablConfigFromEnv(process.env);
export const proxyablClient = createProxyablClient(proxyablConfig);

// ---------- Explicabl config ----------
const explicablLogger = createConsoleLogger({
  serviceName: "tool-gateway",
  environment: process.env.NODE_ENV ?? "dev",
});
const explicablMiddleware = explicablLoggingMiddleware(explicablLogger);

// ---- Identifiabl verifier ----
export const identifiablVerifier = createIdentifiablVerifier({
  issuer: OAUTH_ISSUER,
  audience: OAUTH_AUDIENCE || "",
  jwksUri: JWKS_URI_FALLBACK,
});

function getBearerToken(req: Request): string {
  const auth = req.header("authorization") || "";
  if (!auth.startsWith("Bearer ")) return "";
  return auth.slice(7);
}

// ---------- Tool gateway (main handler) ----------
async function baseToolGatewayImplv3(req: Request, res: Response): Promise<void> {
  setCorsHeaders(res, false);
  console.log("[rest:req]", { path: (req as any).path ?? req.url, method: req.method });

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // MCP:
  if (req.method === "POST" && looksLikeJsonRpc(req.body)) {
    await handleMcp(req, res);
    return;
  }
  if ((req.method === "POST" || req.method === "OPTIONS") && (req as any).path === "/mcp") {
    await handleMcp(req, res);
    return;
  }

  const p = (req as any).path ?? req.url;

  // /debug-token
  if (p === "/debug-token" && (req.method === "GET" || req.method === "HEAD")) {
    if (req.method === "HEAD") {
      res.status(200).end();
      return;
    }
    try {
      const payload = await verifyBearer(req);
      const scopeStr = typeof (payload as any).scope === "string" ? (payload as any).scope : "";
      const permissions = Array.isArray((payload as any).permissions)
        ? ((payload as any).permissions as string[])
        : [];

      res.setHeader("Content-Type", "application/json");
      res.status(200).json({
        ok: true,
        sub: payload.sub,
        aud: payload.aud,
        scope: scopeStr,
        permissions,
      });
    } catch (e: any) {
      res.status(e?.status || 401).json({ ok: false, error: e?.message || "VERIFY_FAILED" });
    }
    return;
  }

  // root health
  if ((req.method === "GET" || req.method === "HEAD") && (p === "/" || p === "")) {
    if (req.method === "HEAD") {
      res.status(200).end();
      return;
    }
    res.setHeader("Content-Type", "application/json");
    res.status(200).send({
      ok: true,
      service: "tool-gateway",
      well_known: [
        "/.well-known/oauth-protected-resource",
        "/.well-known/openid-configuration",
      ],
      message:
        "Send POST /mcp (MCP JSON-RPC), or POST /{toolName} with Bearer token to invoke a tool.",
    });
    return;
  }

  // well-known endpoints
  if (
    (req.method === "GET" || req.method === "HEAD") &&
    (p === "/.well-known/oauth-protected-resource" ||
      p === "/.well-known/oauth-protected-resource-v2")
  ) {
    if (req.method === "HEAD") {
      res.status(200).end();
      return;
    }
    return wellKnownOauthProtectedResourcev2(req, res);
  }

  if ((req.method === "GET" || req.method === "HEAD") &&
      p === "/.well-known/oauth-authorization-server") {
    if (req.method === "HEAD") {
      res.status(200).end();
      return;
    }

    const xfProto = req.get("x-forwarded-proto") || (req as any).protocol || "https";
    const xfHost = req.get("x-forwarded-host") || req.get("host") || "";
    const issuer = OAUTH_ISSUER.replace(/\/+$/, "");

    const doc = {
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
    };

    res.setHeader("Content-Type", "application/json");
    res.status(200).send(doc);
    return;
  }

  if ((req.method === "GET" || req.method === "HEAD") &&
      p === "/.well-known/openid-configuration") {
    if (req.method === "HEAD") {
      res.status(200).end();
      return;
    }
    try {
      const doc = await fetchJsonWithRetry(OIDC_DISCOVERY);
      res.setHeader("Content-Type", "application/json");
      res.status(200).send(doc);
    } catch (e: any) {
      res.status(502).json({ error: "discovery_fetch_failed", detail: e?.message || String(e) });
    }
    return;
  }

  // tools / REST
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: { code: "METHOD_NOT_ALLOWED" } });
    return;
  }

  const locals: any = (res as any).locals || ((res as any).locals = {});
  const requestId = req.header("x-request-id") || randomUUID();
  locals.requestId = requestId;

  const started = Date.now();

  try {
    const name = toolNameFromPath(p);
    if (!name) {
      res.status(400).json({
        ok: false,
        error: { code: "NO_TOOL", message: "Missing tool name" },
        requestId,
      });
      return;
    }

    let uid: string;
    let scopes: string[];
    let payload: any;

    try {
      const verified = await verifyBearerAndScopes(req, name);
      ({ uid, scopes, payload } = verified);

      const locals: any = (res as any).locals || ((res as any).locals = {});
      locals.gatewayContext = {
        identity: {
          uid,
          sub: payload.sub,
          scopes,
          tool: name,
        },
      };
    } catch (e: any) {
      res.setHeader("WWW-Authenticate", e?.www || buildWwwAuthenticate(req));
      res.status(Number(e?.status) || 401).json({
        ok: false,
        error: { code: e?.code || "UNAUTHORIZED", message: e?.message || "Unauthorized" },
        requestId,
      });
      return;
    }

    // ✅ Pattern 1: forward the original OAuth access token to the backend
    const accessToken = getBearerToken(req);
    if (!accessToken) {
      res.setHeader("WWW-Authenticate", buildWwwAuthenticate(req));
      res.status(401).json({
        ok: false,
        error: { code: "NO_AUTH", message: "Missing Bearer token" },
        requestId,
      });
      return;
    }

    const raw = await proxyablClient.callTool(name, req.body ?? {}, accessToken);

    const payloadOut = raw;
    const httpOk = (payloadOut as any)?.ok !== false;
    const elapsedMs = Date.now() - started;

    if (!httpOk) {
      res.status(500).json({
        ok: false,
        error: { code: "BACKEND_ERROR", message: "Backend returned ok:false", details: payloadOut },
        requestId,
        elapsedMs,
        uid,
      });
      return;
    }

    res.status(200).json({ ok: true, data: payloadOut, requestId, elapsedMs, uid });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    console.error("[rest:error]", { status, message: e?.message || String(e) });
    res.status(status).json({
      ok: false,
      error: { code: e?.code || "GATEWAY_ERROR", message: e?.message || String(e) },
    });
  }
}

export async function toolGatewayImplv3(req: Request, res: Response): Promise<void> {
  return new Promise<void>((resolve) => {
    explicablMiddleware(req as any, res as any, (expErr?: any) => {
      if (expErr) {
        console.error("[toolGatewayImplv3] Explicabl middleware error", expErr);
        if (!res.headersSent) {
          res.status(500).json({
            ok: false,
            error: { code: "EXPLICABL_ERROR", message: expErr?.message || "Explicabl middleware error" },
          });
        }
        return resolve();
      }

      Promise.resolve(baseToolGatewayImplv3(req, res))
        .then(() => resolve())
        .catch((e) => {
          console.error("[toolGatewayImplv3] Unhandled error from baseToolGatewayImplv3", e);
          if (!res.headersSent) {
            res.status(500).json({
              ok: false,
              error: { code: "GATEWAY_ERROR", message: e?.message || String(e) },
            });
          }
          resolve();
        });
    });
  });
}

export { toolGatewayImplv3 as toolGatewayImpl };
