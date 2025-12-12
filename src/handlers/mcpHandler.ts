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
import { getProxyablClientForRequest } from "../gateway/toolGateway";
import { setCorsHeaders } from "./httpHelpers";

type JsonRpcReq = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: any;
};

type JsonRpcRes =
  | { jsonrpc: "2.0"; id: string | number | null; result: any }
  | { jsonrpc: "2.0"; id: string | number | null; error: { code: number; message: string; data?: any } };

function jsonRpcResult(id: any, result: any): JsonRpcRes {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function jsonRpcError(id: any, code: number, message: string, data?: any): JsonRpcRes {
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

function getBearerToken(req: Request): string {
  const auth = req.header("authorization") || "";
  if (!auth.startsWith("Bearer ")) return "";
  return auth.slice(7);
}

// === MCP START ===
export async function handleMcp(req: Request, res: Response) {
  setCorsHeaders(res, true);
  console.log("[mcp:req]", { path: (req as any).path ?? req.url, method: req.method });

  if (req.method === "OPTIONS") { res.status(204).end(); return; }

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
    res.status(400).json(jsonRpcError(rpc?.id ?? null, -32600, "Invalid Request"));
    return;
  }

  // initialize
  if (rpc.method === "initialize") {
    const result = {
      protocolVersion: "2024-11-05",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "gatewaystack-chatgpt-starter", version: "1.0.0" },
    };
    res.status(200).json(jsonRpcResult(rpc.id ?? null, result));
    return;
  }

  if (rpc.method === "notifications/initialized") {
    res.status(202).end();
    return;
  }

  if (rpc.method === "tools/list") {
    const { hasAuth, tokenShape } = readAuth(req);

    if (!hasAuth || tokenShape !== "jwt") {
      res.setHeader("WWW-Authenticate", buildWwwAuthenticate(req) + ', error="invalid_token"');
      res.status(401).json(jsonRpcError(rpc.id ?? null, -32001, "Unauthorized"));
      return;
    }

    try {
      await verifyBearer(req);
    } catch (e: any) {
      res.setHeader("WWW-Authenticate", e?.www || buildWwwAuthenticate(req));
      res.status(Number(e?.status) || 401).json(jsonRpcError(rpc.id ?? null, -32001, e?.message || "Unauthorized"));
      return;
    }

    res.status(200).json(jsonRpcResult(rpc.id ?? null, { tools: mcpToolDescriptors() }));
    return;
  }

  if (rpc.method === "tools/call") {
    const name = rpc.params?.name;
    const args = rpc.params?.arguments ?? {};

    logAuthShape("mcp.tools/call", req);

    if (typeof name !== "string" || !TOOL_SCOPES[name]) {
      res.status(404).json(jsonRpcError(rpc.id ?? null, -32601, `Unknown tool: ${name}`));
      return;
    }

    // prompt OAuth if token is missing or not JWT
    {
      const { hasAuth, tokenShape } = readAuth(req);
      if (!hasAuth || tokenShape !== "jwt") {
        res.setHeader("WWW-Authenticate", buildWwwAuthenticate(req) + ', error="invalid_token"');
        res.status(401).json(jsonRpcError(rpc.id ?? null, -32001, "Unauthorized"));
        return;
      }
    }

    let uid: string, payload: any;
    try {
      const verified = await verifyBearerAndScopes(req, name);
      ({ uid, payload } = verified);
    } catch (e: any) {
      res.setHeader("WWW-Authenticate", e?.www || buildWwwAuthenticate(req));
      res.status(Number(e?.status) || 401).json(jsonRpcError(rpc.id ?? null, -32001, e?.message || "Unauthorized"));
      return;
    }

    // ✅ Pattern 1: forward original OAuth token to backend
    const accessToken = getBearerToken(req);
    const raw = await getProxyablClientForRequest(req).callTool(name, args, accessToken);

    const payloadOut = raw;
    const isJson = typeof payloadOut === "object" && payloadOut !== null;
    const httpOk = (payloadOut as any)?.ok !== false;

    const summaryText = isJson ? summarizeToolResult(name, payloadOut) : String(payloadOut ?? "");

    const baseResult: any = {
      isError: !httpOk,
      content: [{ type: "text" as const, text: summaryText || (isJson ? JSON.stringify(payloadOut).slice(0, 800) : String(payloadOut ?? "")) }],
    };

    if (isJson) {
      try {
        baseResult.structuredContent =
          formatStructuredForTool(name, payloadOut) ??
          formatStructuredContent(name, payloadOut, args) ??
          JSON.parse(JSON.stringify(payloadOut));
      } catch {}
    }

    res.status(200).json(jsonRpcResult(rpc.id ?? null, baseResult));
    return;
  }

  res.status(400).json(jsonRpcError(rpc.id ?? null, -32601, `Method not found: ${rpc.method}`));
}
