// Per-tool required scopes.
// IMPORTANT: these must match what your OAuth provider issues.
export const TOOL_SCOPES: Record<string, string[]> = {
  whoami: ["starter.whoami"],
  echo: ["starter.echo"],

  seedMyNotes: ["starter.notes"],
  listMyNotes: ["starter.notes"],
  addNote: ["starter.notes"],
};

// Convenience: union of all required scopes (used for OAuth prompting)
export const REQUIRED_SCOPES = Array.from(
  new Set(Object.values(TOOL_SCOPES).flat())
).sort();

// What ChatGPT sees when it calls tools/list
export function mcpToolDescriptors() {
  return [
    {
      name: "whoami",
      description:
        "Return the current authenticated user identity (sub + scopes). Useful to verify user-scoped auth wiring.",
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
      description:
        "Create a few demo notes for the current user (stored by OAuth sub).",
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
      description:
        "List the current user's notes (scoped by OAuth sub).",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "addNote",
      description:
        "Add a note for the current user (scoped by OAuth sub).",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Note text." },
        },
        required: ["text"],
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
    const sub = p?.sub ?? "";
    const scope = p?.scope ?? "";
    const permissions = Array.isArray(p?.permissions) ? p.permissions : [];
    const scopes = [scope, ...permissions].join(" ").trim();
    return `You are sub=${sub || "(unknown)"} scopes=${scopes || "(none)"}`;
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
