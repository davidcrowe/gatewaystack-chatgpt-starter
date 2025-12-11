import express from "express";
import { randomUUID } from "crypto";
import { requireJwt, type AuthedRequest } from "./jwtAuth";
import { seedNotes, listNotes, addNote } from "./store";

export function createDemoApiRouter() {
  const router = express.Router();

  router.use(express.json({ limit: "1mb" }));

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
  router.post("/tools/:toolName", (req: AuthedRequest, res) => {
    const toolName = String(req.params.toolName || "");

    switch (toolName) {
      case "whoami": {
        return res.json({
          ok: true,
          sub: req.auth!.sub,
          scope: req.auth!.scope ?? "",
          permissions: req.auth!.permissions ?? [],
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
