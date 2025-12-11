// src/handlers/mcpHandler.ts
import type { Request, Response } from "express";

import {
  TOOL_SCOPES,
  summarizeToolResult,
  formatStructuredContent,
  formatStructuredForTool,
  mcpToolDescriptors,
} from "../tools/tools";
import {
  verifyBearer,
  buildWwwAuthenticate,
  readAuth,
  verifyBearerAndScopes,
  logAuthShape,
} from "./authHelpers";
import { proxyablClient } from "../gateway/toolGateway-firebase";
import { setCorsHeaders } from "./httpHelpers";
import { getFirebaseIdTokenForUid } from "./firebaseAdapter";

type JsonRpcReq = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: any;
};

type JsonRpcRes =
  | { jsonrpc: "2.0"; id: string | number | null; result: any }
  | {
      jsonrpc: "2.0";
      id: string | number | null;
      error: { code: number; message: string; data?: any };
    };

function jsonRpcResult(id: any, result: any): JsonRpcRes {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function jsonRpcError(
  id: any,
  code: number,
  message: string,
  data?: any
): JsonRpcRes {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message, data } };
}

export function looksLikeJsonRpc(body: any): boolean {
  try {
    const b = typeof body === "string" ? JSON.parse(body) : body;
    return b && b.jsonrpc === "2.0" && typeof b.method === "string";
  } catch {
    return false;
  }
}

// === MCP START ===
export async function handleMcp(req: Request, res: Response) {
  // CORS like your gateway
  setCorsHeaders(res, true); // JSON response
  console.log("[mcp:req]", {
    path: (req as any).path ?? req.url,
    method: req.method,
  });

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: { code: "METHOD_NOT_ALLOWED" } });
    return;
  }

  let rpc: JsonRpcReq;
  try {
    rpc = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json(jsonRpcError(null, -32700, "Parse error"));
    return;
  }

  if (!rpc || rpc.jsonrpc !== "2.0" || typeof rpc.method !== "string") {
    res
      .status(400)
      .json(jsonRpcError(rpc?.id ?? null, -32600, "Invalid Request"));
    return;
  }

  console.log("[debug] rpc.method", rpc.method, rpc.params);
  console.log("[mcp] rpc", { method: rpc.method, id: rpc.id ?? null });

  // initialize → return protocol + capabilities (no auth required)
  if (rpc.method === "initialize") {
    console.log("[mcp] initialize");
    const result = {
      protocolVersion: "2024-11-05", // or current MCP protocol version
      capabilities: {
        tools: { listChanged: false },
        // resources omitted for starter; add when you implement resources/list + resources/read
      },
      serverInfo: { name: "gatewaystack-chatgpt-starter", version: "1.0.0" },
    };
    res.status(200).json(jsonRpcResult(rpc.id ?? null, result));
    return;
  }

  // notifications/initialized → ack (notification = no id)
  if (rpc.method === "notifications/initialized") {
    console.log("[mcp] notifications/initialized");
    res.status(202).end();
    return;
  }

  // authenticated: list tools (force OAuth discovery)
  if (rpc.method === "tools/list") {
    console.log("[mcp] tools/list start");
    const { hasAuth, tokenShape } = readAuth(req);

    if (!hasAuth || tokenShape !== "jwt") {
      const www = buildWwwAuthenticate(req) + ', error="invalid_token"';
      res.setHeader("WWW-Authenticate", www);
      console.warn("[mcp] tools/list → 401 (prompting OAuth)", {
        hasAuth,
        tokenShape,
        len: req.header("authorization")?.length || 0,
      });
      res
        .status(401)
        .json(jsonRpcError(rpc.id ?? null, -32001, "Unauthorized"));
      return;
    }

    try {
      await verifyBearer(req);
    } catch (e: any) {
      const www = e?.www || buildWwwAuthenticate(req);
      res.setHeader("WWW-Authenticate", www);
      console.warn("[mcp] tools/list auth fail", {
        message: e?.message,
        status: e?.status,
        code: e?.code,
      });
      res
        .status(Number(e?.status) || 401)
        .json(jsonRpcError(rpc.id ?? null, -32001, e?.message || "Unauthorized"));
      return;
    }

    console.log("[mcp] tools/list authed");
    const tools = mcpToolDescriptors();
    res.status(200).json(jsonRpcResult(rpc.id ?? null, { tools }));
    return;
  }

  // protected: call a tool
  if (rpc.method === "tools/call") {
    const name = rpc.params?.name;
    const args = rpc.params?.arguments ?? {};

    console.log("[mcp] tools/call start", { name });
    logAuthShape("mcp.tools/call", req);

    if (typeof name !== "string" || !TOOL_SCOPES[name]) {
      res
        .status(404)
        .json(
          jsonRpcError(rpc.id ?? null, -32601, `Unknown tool: ${name}`)
        );
      return;
    }

    // Early guard: reject non-JWT and prompt OAuth
    {
      const { hasAuth, tokenShape } = readAuth(req);
      if (!hasAuth || tokenShape !== "jwt") {
        const www = buildWwwAuthenticate(req) + ', error="invalid_token"';
        res.setHeader("WWW-Authenticate", www);
        console.warn("[mcp] tools/call → 401 (non-JWT token)", {
          hasAuth,
          tokenShape,
          name,
        });
        res
          .status(401)
          .json(jsonRpcError(rpc.id ?? null, -32001, "Unauthorized"));
        return;
      }
    }

    let uid: string, scopes: string[], payload: any;
    try {
      const verified = await verifyBearerAndScopes(req, name);
      ({ uid, scopes, payload } = verified);
    } catch (e: any) {
      if (e?.www) res.setHeader("WWW-Authenticate", e.www);
      else res.setHeader("WWW-Authenticate", buildWwwAuthenticate(req));
      res
        .status(Number(e?.status) || 401)
        .json(jsonRpcError(rpc.id ?? null, -32001, e?.message || "Unauthorized"));
      return;
    }

    // 🔐 Get Firebase ID token for this uid so the backend can verifyIdToken()
    const idToken = await getFirebaseIdTokenForUid(uid);

    const raw = await proxyablClient.callTool(name, args, idToken);

    const payloadOut = raw;
    const isJson = typeof payloadOut === "object" && payloadOut !== null;

    // Treat { ok: false } as an error if present; otherwise assume success
    const httpOk = (payloadOut as any)?.ok !== false;
    const httpStatus = 200;

    console.log("[proxyabl] tools/call normalized", {
      name,
      httpOk,
      httpStatus,
      isJson,
      payloadType: typeof payloadOut,
    });

    // Use a short, human-readable summary for the model, not raw JSON
    const summaryText = isJson
      ? summarizeToolResult(name, payloadOut)
      : String(payloadOut ?? "");

    const contentItems = [
      {
        type: "text" as const,
        text:
          typeof summaryText === "string" && summaryText.trim().length > 0
            ? summaryText
            : isJson
            ? JSON.stringify(payloadOut).slice(0, 800)
            : String(payloadOut ?? ""),
      },
    ];

    const baseResult: any = {
      isError: false,
      content: contentItems,
    };

    // --- structuredContent wiring ---
    if (isJson) {
      try {
        const normalized = formatStructuredForTool(name, payloadOut);
        if (normalized) {
          baseResult.structuredContent = normalized;
        } else {
          const ui = formatStructuredContent(name, payloadOut, args);
          if (ui) {
            baseResult.structuredContent = ui;
          } else {
            const parsed = JSON.parse(JSON.stringify(payloadOut));
            baseResult.structuredContent = parsed;
          }
        }
      } catch {
        try {
          const parsed = JSON.parse(JSON.stringify(payloadOut));
          baseResult.structuredContent = parsed;
        } catch {
          // ignore if not serializable
        }
      }
    }

    // If your function failed, still return 200 JSON-RPC with an error flag
    if (!httpOk) {
      res.status(200).json(
        jsonRpcResult(rpc.id ?? null, {
          ...baseResult,
          isError: true,
        })
      );
      return;
    }

    console.log("[mcp] tools/call result", {
      name,
      hasStructured: !!baseResult.structuredContent,
      structuredPreview: JSON.stringify(baseResult.structuredContent)?.slice(
        0,
        400
      ),
      isError: false,
    });

    // Success
    res.status(200).json(
      jsonRpcResult(rpc.id ?? null, {
        ...baseResult,
        isError: false,
      })
    );
    return;
  }

  res
    .status(400)
    .json(
      jsonRpcError(
        rpc.id ?? null,
        -32601,
        `Method not found: ${rpc.method}`
      )
    );
}
