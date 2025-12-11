import type { Response } from "express";

const APP_ORIGIN = process.env.APP_ORIGIN || "*";

// ---------- Helpers ----------
export function toolNameFromPath(path: string): string | null {
  const parts = path.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

export function setCorsHeaders(res: Response, json: boolean = false) {
  res.setHeader("Access-Control-Allow-Origin", APP_ORIGIN);
  res.setHeader("Vary", "Origin");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization,content-type,x-request-id"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
  res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate, Location");
  if (json) {
    res.setHeader("Content-Type", "application/json");
  }
}

// Small robust fetch with timeout + retry (no external deps)
export async function fetchJsonWithRetry(url: string, tries = 3, timeoutMs = 4000): Promise<any> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { headers: { accept: "application/json" }, signal: ctrl.signal } as any);
      clearTimeout(t);
      if (!r.ok) throw new Error(`http_${r.status}`);
      return await r.json();
    } catch (e) {
      lastErr = e;
      await new Promise(res => setTimeout(res, 150 * (i + 1)));
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}