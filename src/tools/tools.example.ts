// src/tools/innerTools.example.ts
export const TOOL_SCOPES: Record<string, string[]> = {
  echo: ["starter.echo"],
};

// Convenience: union of all required scopes
export const REQUIRED_SCOPES = Array.from(
  new Set(Object.values(TOOL_SCOPES).flat())
).sort();

// MCP tool descriptors (what ChatGPT sees)
export function mcpToolDescriptors() {
  return [
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
  ];
}

// Human readable text summary for model chat
export function summarizeToolResult(toolName: string, payload: any): string {
  if (toolName === "echo") {
    const msg = payload?.message ?? payload?.data?.message ?? payload?.echo ?? "";
    return `Echo: ${String(msg)}`;
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
