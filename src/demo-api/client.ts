// src/demo-api/client.ts

export type DemoApiClientOptions = {
  baseUrl?: string; // default: http://localhost:3000/demo
};

function demoBaseUrl() {
  return (process.env.DEMO_API_BASE_URL || "http://localhost:3000/demo").replace(/\/+$/, "");
}

export async function callDemoApi(
  path: string,
  bearerAccessToken: string,
  opts?: { method?: string; body?: any; baseUrl?: string }
) {
  const baseUrl = (opts?.baseUrl || demoBaseUrl()).replace(/\/+$/, "");
  const url = `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;

  const method = opts?.method || (opts?.body ? "POST" : "GET");
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${bearerAccessToken}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(url, {
    method,
    headers,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let json: any;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }

  if (!res.ok) {
    const err: any = new Error(`demo_api_http_${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }

  return json;
}
