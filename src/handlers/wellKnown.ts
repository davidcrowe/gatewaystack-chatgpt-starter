// functions/src/handlers/wellKnown.ts
import type { Request, Response } from "express";
import { REQUIRED_SCOPES } from "../tools/tools";
import {
  OAUTH_ISSUER,
  OAUTH_AUDIENCE,
  OAUTH_SCOPES,
  JWKS_URI_FALLBACK,
} from "./oauthConfig";

export async function wellKnownOauthProtectedResourcev2(
  req: Request,
  res: Response
): Promise<void> {
  const ua = req.get("user-agent") || "";
  const origin = req.get("origin") || "";
  const referer = req.get("referer") || "";
  const xfProto = req.get("x-forwarded-proto") || req.protocol || "https";
  const xfHost = req.get("x-forwarded-host") || req.get("host") || "";
  const fullUrl = `${xfProto}://${xfHost}${req.originalUrl || req.url}`;
  const baseUrl = `${xfProto}://${xfHost}`;

  console.log("[wk] /.well-known/oauth-protected-resource served", {
    url: fullUrl,
    method: req.method,
    ua,
    origin,
    referer,
  });
  console.log("[wk.cfg]", {
    issuer: OAUTH_ISSUER,
    audience: OAUTH_AUDIENCE || null,
    jwks_uri_fallback: JWKS_URI_FALLBACK,
    required_scopes: REQUIRED_SCOPES,
  });

  const scopes_supported = Array.from(
    new Set([
      ...OAUTH_SCOPES.split(" ").filter(Boolean),
      ...REQUIRED_SCOPES,
    ])
  );

  const payload: any = {
    // Tell ChatGPT this server supports OAuth Bearer
    authorization_servers: [baseUrl],
    scopes_supported,
    bearer_methods_supported: ["header"],
  };

  if (OAUTH_AUDIENCE) {
    payload.resource = OAUTH_AUDIENCE;
  }

  res.setHeader("Content-Type", "application/json");
  res.status(200).send(payload);
}