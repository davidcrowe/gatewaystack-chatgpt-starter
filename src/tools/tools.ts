// Per-tool required scopes.
// IMPORTANT: these must match what your OAuth provider issues.
export const TOOL_SCOPES: Record<string, string[]> = {
  whoami: ["starter.whoami"],
  echo: ["starter.echo"],

  seedMyNotes: ["starter.notes"],
  listMyNotes: ["starter.notes"],
  addNote: ["starter.notes"],

  crmInit: ["starter.crm"],
  crmGetSalesSummary: ["starter.crm"], 
};

// Convenience: union of all required scopes (used for OAuth prompting)
export const REQUIRED_SCOPES = Array.from(new Set(Object.values(TOOL_SCOPES).flat())).sort();

// What ChatGPT sees when it calls tools/list
export function mcpToolDescriptors() {
  return [
    {
      name: "whoami",
      description:
        "Return an OAuth-verified identity proof panel (user + issuer/audience/scopes/expiry). Use to validate user-scoped auth end-to-end.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "echo",
      description: "Echo back the input (starter demo tool).",
      inputSchema: {
        type: "object",
        properties: {
          message: { type: "string", description: "Message to echo." },
        },
        required: ["message"],
        additionalProperties: false,
      },
    },
    {
      name: "seedMyNotes",
      description: "Create a few demo notes for the current user (stored by OAuth sub).",
      inputSchema: {
        type: "object",
        properties: {
          count: { type: "number", description: "How many notes to create (default 3)." },
        },
        additionalProperties: false,
      },
    },
    {
      name: "listMyNotes",
      description: "List the current user's notes (scoped by OAuth sub).",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "addNote",
      description: "Add a note for the current user (scoped by OAuth sub).",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Note text." },
        },
        required: ["text"],
        additionalProperties: false,
      },
    },
    {
      name: "crmInit",
      description:
        "Initialize a mock CRM for the current user (no PII stored). Seeds dummy deals if this user is new and returns a welcome message plus database counts and suggested commands.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "crmGetSalesSummary",
      description:
        "Return mock CRM sales totals for a given quarter/year for the current authenticated user. Example: {year: 2025, quarter: 2}.",
      inputSchema: {
        type: "object",
        properties: {
          year: { type: "number", description: "e.g. 2025" },
          quarter: { type: "number", description: "1-4" },
        },
        required: ["year", "quarter"],
        additionalProperties: false,
      },
    },
  ];
}

// Human-readable summary text shown to the model
export function summarizeToolResult(toolName: string, payload: any): string {
  const p = payload?.data ?? payload;

  if (toolName === "echo") {
    const msg = p?.message ?? p?.echo ?? "";
    return `Echo: ${String(msg)}`;
  }

  if (toolName === "whoami") {
    // Support BOTH old + new shapes, so you can deploy without breaking anything.
    const proof = typeof p?.proof === "string" ? p.proof : null;

    const user = p?.user ?? {};
    const auth = p?.authorization ?? {};

    const sub = user?.sub ?? p?.sub ?? "";
    const email = user?.email ?? null;
    const userKey = user?.user_key ?? null;

    const scope = auth?.scope ?? p?.scope ?? "";
    const scopeList = Array.isArray(auth?.scope_list) ? auth.scope_list : [];
    const permissions = Array.isArray(auth?.permissions)
      ? auth.permissions
      : Array.isArray(p?.permissions)
        ? p.permissions
        : [];

    const issuer = auth?.issuer ?? null;
    const expInSec = typeof auth?.exp_in_seconds === "number" ? auth.exp_in_seconds : null;

    const scopesPretty = [...scopeList, ...permissions].filter(Boolean).join(" ").trim();

    // Keep it punchy in the chat surface:
    if (proof) return proof;

    const who = email ? `${email}` : sub ? `sub=${sub}` : "(unknown)";
    const key = userKey ? ` user_key=${userKey}` : "";
    const iss = issuer ? ` issuer=${issuer}` : "";
    const exp = expInSec !== null ? ` exp_in=${Math.floor(expInSec / 60)}m` : "";

    return `✅ Verified OAuth user: ${who}${key}${iss}${exp} scopes=${scopesPretty || scope || "(none)"}`;
  }

  if (toolName === "seedMyNotes") {
    const seeded = Array.isArray(p?.seeded) ? p.seeded : [];
    return `Seeded ${seeded.length} notes.`;
  }

  if (toolName === "listMyNotes") {
    const notes = Array.isArray(p?.notes) ? p.notes : [];
    return `You have ${notes.length} notes.`;
  }

  if (toolName === "addNote") {
    const note = p?.note;
    const text = note?.text ?? "";
    return `Added note: ${String(text).slice(0, 120)}`;
  }

  if (toolName === "crmInit") {
    const w = p?.welcome;
    if (!w) return "CRM initialized.";
    return `Welcome ${w.user}. ${w.seeded ? `Created ${w.createdDeals} dummy deals for you.` : "Your demo CRM is ready."} Database: ${w.dbUsers} users, ${w.dbEntries} total entries. Try: “${(w.try?.[0] || "What were my sales in Q2 2025?")}”`;
  }


  if (toolName === "crmGetSalesSummary") {
    const s = p?.summary;
    if (!s) return "Sales summary unavailable.";

    const dollars = (Number(s.revenue_cents || 0) / 100).toFixed(0);
    return `📊 Sales in Q${s.quarter} ${s.year}: $${dollars} across ${s.deals_won} won deals.`;
  }

  return `Tool '${toolName}' completed.`;
}

// Optional: normalize output into a stable shape for UI/components
export function formatStructuredForTool(_toolName: string, _payload: any): any | null {
  return null;
}

// Optional: tool-specific UI schema (widgets etc). Keep null in starter.
export function formatStructuredContent(_toolName: string, _payload: any, _args?: any): any | null {
  return null;
}