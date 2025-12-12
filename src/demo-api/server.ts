import express from "express";
import { randomUUID } from "crypto";
import { requireJwt, type AuthedRequest } from "./jwtAuth";
import { seedNotes, listNotes, addNote } from "./store";

export function createDemoApiRouter() {
  const router = express.Router();

  router.use(express.json({ limit: "1mb" }));

  router.use((req, _res, next) => {
    console.log("[runtime:req]", {
      rev: process.env.K_REVISION,
      sha: process.env.GIT_SHA,
      path: req.path,
      method: req.method,
    });
    next();
  });

  // basic request logging
  router.use((req, _res, next) => {
    const requestId = req.header("x-request-id") || randomUUID();
    (req as any).requestId = requestId;
    console.log("[demo-api:req]", { requestId, method: req.method, path: req.path });
    removingSecretsLog(req);
    next();
  });

  router.get("/health", (_req, res) => res.json({ ok: true, service: "demo-api" }));

  // all demo endpoints require the same OAuth JWT (Pattern 1)
  router.use(requireJwt);

  // Proxyabl will call POST {FUNCTIONS_BASE}/tools/<toolName>
  router.post("/:toolName", (req: AuthedRequest, res) => {
    const toolName = String(req.params.toolName || "");

    switch (toolName) {
      case "whoami": {
        const a = req.auth!;
        const p = (a.payload ?? {}) as any;

        const now = Math.floor(Date.now() / 1000);
        const exp = typeof p.exp === "number" ? p.exp : undefined;
        const iat = typeof p.iat === "number" ? p.iat : undefined;

        const expInSec = exp ? exp - now : undefined;
        const expInMin = expInSec !== undefined ? Math.floor(expInSec / 60) : undefined;

        // Safe, visual “per-user” proof without revealing secrets (not reversible)
        const userKey = Buffer.from(String(a.sub)).toString("base64url").slice(0, 10);

        // Make scope visually legible (space-separated OAuth scopes)
        const scope =
          typeof a.scope === "string" ? a.scope : typeof p.scope === "string" ? p.scope : "";
        const scopeList = scope ? scope.split(" ").filter(Boolean) : [];

        // Optional human-friendly fields (only if present in token)
        const email = typeof p.email === "string" ? p.email : undefined;
        const name = typeof p.name === "string" ? p.name : undefined;

        // One-line “punchline” for demo readability
        const proof = [
          "✅ Verified OAuth JWT",
          email ? `for ${email}` : `for sub ${String(a.sub).slice(0, 18)}…`,
          expInMin !== undefined ? `(expires in ~${expInMin} min)` : "",
        ]
          .filter(Boolean)
          .join(" ");

        return res.json({
          ok: true,
          proof,
          verified: true,
          source: a.source ?? "jwt",
          user: {
            sub: a.sub,
            user_key: userKey,
            email: email ?? null,
            name: name ?? null,
          },
          authorization: {
            issuer: typeof p.iss === "string" ? p.iss : null,
            audience: p.aud ?? null,
            scope,
            scope_list: scopeList,
            permissions: a.permissions ?? (Array.isArray(p.permissions) ? p.permissions : []),
            iat: iat ?? null,
            exp: exp ?? null,
            exp_in_seconds: expInSec ?? null,
          },
          request: {
            requestId: (req as any).requestId ?? null,
            rev: process.env.K_REVISION ?? null,
            sha: process.env.GIT_SHA ?? null,
          },
        });
      }

      case "echo": {
        const message = String(req.body?.message ?? "");
        return res.json({ ok: true, message });
      }

      case "seedMyNotes": {
        const countRaw = Number(req.body?.count ?? 3);
        const count = Number.isFinite(countRaw) ? countRaw : 3;
        const seeded = seedNotes(req.auth!.sub, count);
        return res.json({ ok: true, seeded });
      }

      case "listMyNotes": {
        const notes = listNotes(req.auth!.sub);
        return res.json({ ok: true, notes });
      }

      case "addNote": {
        const text = String(req.body?.text ?? "").trim();
        if (!text) return res.status(400).json({ ok: false, error: "missing_text" });
        const note = addNote(req.auth!.sub, text);
        return res.json({ ok: true, note });
      }

      default:
        return res.status(404).json({ ok: false, error: "unknown_tool", toolName });
    }
  });

  return router;
}

function removingSecretsLog(req: any) {
  // Don’t print auth token contents; just show if present
  const hasAuth = !!req.header("authorization");
  console.log("[demo-api:auth]", { hasAuth });
}
