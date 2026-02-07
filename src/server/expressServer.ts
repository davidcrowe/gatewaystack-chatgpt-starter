import express from "express";
import rateLimit from "express-rate-limit";
import { toolGatewayImpl } from "../gateway/toolGateway.js";
import { createDemoApiRouter } from "../demo-api/server.js";

/**
 * Derive the externally-reachable base URL for this service from the incoming request.
 * Works behind Cloud Run / reverse proxies.
 *
 * Example: https://my-service-abc123.a.run.app
 */
export function getPublicBaseUrl(req: express.Request): string {
  const proto = (req.header("x-forwarded-proto") ?? req.protocol)
    .split(",")[0]
    .trim();

  const host = (req.header("x-forwarded-host") ?? req.header("host") ?? "")
    .split(",")[0]
    .trim();

  if (!host) throw new Error("Missing Host header; cannot derive public base URL");

  return `${proto}://${host}`;
}

/**
 * Helpful guardrail: detects common misconfig patterns like
 * "http://localhost:${PORT}" that will break in Cloud Run (and break fetch URL parsing).
 */
function warnIfSuspiciousEnv(): void {
  const candidates = [
    "TOOLS_BASE_URL",
    "FUNCTIONS_BASE",
    "MCP_BASE_URL",
    "PROXYABL_BASE_URL",
    "TOOL_GATEWAY_BASE_URL",
  ];

  for (const key of candidates) {
    const v = process.env[key];
    if (!v) continue;

    if (/\$\{[^}]+\}/.test(v)) {
      console.warn(
        `[startup][warn] ${key} contains an unexpanded \${...} placeholder: ${v}`
      );
    }
    if (/localhost/i.test(v)) {
      console.warn(
        `[startup][warn] ${key} contains localhost. This is almost always wrong in Cloud Run: ${v}`
      );
    }
    try {
      // Throws if invalid
      new URL(v);
    } catch {
      console.warn(`[startup][warn] ${key} is not a valid URL: ${v}`);
    }
  }
}

export function createApp() {
  warnIfSuspiciousEnv();

  const app = express();

  // IMPORTANT: ChatGPT MCP sends JSON; keep body parsing permissive
  // Note: If you parse text for "*/*", it can swallow JSON; order matters.
  // We'll keep JSON first, then text for non-JSON.
  app.use(express.json({ limit: "2mb" }));
    app.use(
    express.text({
        type: (req) => {
        const ct = String(req.headers["content-type"] ?? "");
        return !ct.includes("application/json");
        },
        limit: "2mb",
    })
    );

  // Rate limiting — 100 requests per minute per IP
  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 100,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    })
  );

  // Demo backend mounted on same server (Cloud Run friendly)
  app.use("/demo", createDemoApiRouter());

  app.get("/favicon.ico", (_req, res) => res.status(204).end());
  app.get("/favicon.png", (_req, res) => res.status(204).end());
  app.get("/favicon.svg", (_req, res) => res.status(204).end());

  // Everything else is the MCP gateway
  app.all("*", (req, res) => {
    // (Optional) expose derived base URL for debugging during integration
    // console.log("[request] publicBase", getPublicBaseUrl(req));
    return toolGatewayImpl(req as any, res as any);
  });

  return app;
}

const port = Number(process.env.PORT || 3000);
createApp().listen(port, () => {
  console.log(`[starter] listening on http://localhost:${port}`);
  console.log(`[starter] demo api at     http://localhost:${port}/demo/health`);
});
