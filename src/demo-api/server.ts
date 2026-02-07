import express from "express";
import { randomUUID } from "crypto";
import { requireJwt, type AuthedRequest } from "./jwtAuth.js";
import { seedNotes, listNotes, addNote } from "./store.js";
import { salesSummary } from "./crm/queries.js";
import { userKeyFromSubject, userLabel } from "./crm/identity.js";
import { ensureSeeded } from "./crm/seed.js";
import { getGlobalCounts, deleteUserData } from "./crm/db.js";

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

      case "crmInit": {
        // Never store sub. Convert it to a non-reversible key.
        const subject = String(req.auth!.sub || "");
        const userKey = userKeyFromSubject(subject);

        const seed = ensureSeeded(userKey);
        const counts = getGlobalCounts();

        return res.json({
          ok: true,
          welcome: {
            user: userLabel(userKey),
            seeded: seed.seeded,
            createdDeals: seed.createdDeals,
            dbUsers: counts.users,
            dbEntries: counts.entries,
            try: [
              "What were my sales in Q2 2025?",
              "Show my sales in Q4 2024",
              "List my open deals",
            ],
          },
        });
      }

      case "crmGetSalesSummary": {
        const subject = String(req.auth!.sub || "");
        const userKey = userKeyFromSubject(subject);

        // Ensure the user has mock data (idempotent)
        ensureSeeded(userKey);

        const yearRaw = Number(req.body?.year);
        const quarterRaw = Number(req.body?.quarter);

        const year = Number.isFinite(yearRaw) ? yearRaw : new Date().getUTCFullYear();
        const quarter = Number.isFinite(quarterRaw) ? quarterRaw : 1;

        const summary = salesSummary(userKey, year, quarter);

        return res.json({
          ok: true,
          user: userLabel(userKey),
          summary,
        });
      }

      case "crmExplainAccess": {
        const subject = String(req.auth!.sub || "");
        const userKey = userKeyFromSubject(subject);

        // Ensure a user has data (optional but nice: means they can try sales tools right away)
        const seed = ensureSeeded(userKey);
        const counts = getGlobalCounts();

        const label = userLabel(userKey);

        return res.json({
          ok: true,
          access: {
            you_are: label,
            can_access: [
              "Your mock CRM deals",
              "Your mock sales summaries (e.g. Q2 2025)",
              "Your mock pipeline analytics (if enabled)",
            ],
            cannot_access: [
              "Any other user's CRM data",
              "Any data not derived from your OAuth identity",
              "Any PII (we do not store email/name/sub in the CRM database)",
            ],
            why: [
              "All CRM queries are scoped to your authenticated identity (OAuth JWT sub → anonymous user_key).",
              "The CRM database stores only an HMAC-derived user_key (non-reversible) and 100% mock records.",
              "No CRM tool accepts a user identifier input, so cross-user queries are impossible by design.",
            ],
            proof: {
              seeded_now: seed.seeded,
              created_deals: seed.createdDeals,
              db_users: counts.users,
              db_entries: counts.entries,
            },
            try_next: [
              "crmInit",
              "crmGetSalesSummary { year: 2025, quarter: 2 }",
              'Try: crmAttemptCrossUserRead { targetUser: "user-abcdef" }',
            ],
          },
        });
      }

      case "crmAttemptCrossUserRead": {
        const subject = String(req.auth!.sub || "");
        const userKey = userKeyFromSubject(subject);
        ensureSeeded(userKey);

        const requested = String(req.body?.targetUser ?? "").trim();
        const actual = userLabel(userKey);

        // We intentionally do NOT use the requested targetUser for any query.
        return res.status(403).json({
          ok: false,
          error: "cross_user_access_denied",
          requested_target: requested || null,
          actual_scope: actual,
          explanation:
            "CRM tools are hard-scoped to the authenticated identity. The server ignores any requested user and only uses your OAuth identity-derived user_key.",
          how_to_demo:
            "Log in as a second user (incognito), note their user-xxxxxx label from crmInit, then try targeting it here.",
        });
      }

      case "crmResetMyData": {
        const subject = String(req.auth!.sub || "");
        const userKey = userKeyFromSubject(subject);

        deleteUserData(userKey);
        const seed = ensureSeeded(userKey);
        const counts = getGlobalCounts();

        return res.json({
            ok: true,
            reset: true,
            user: userLabel(userKey),
            seeded: seed.seeded,
            createdDeals: seed.createdDeals,
            dbUsers: counts.users,
            dbEntries: counts.entries,
        });
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
