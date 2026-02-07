import { describe, it, expect } from "vitest";
import {
  TOOL_SCOPES,
  REQUIRED_SCOPES,
  mcpToolDescriptors,
  summarizeToolResult,
} from "../src/tools/tools.js";

describe("TOOL_SCOPES", () => {
  it("has scopes for all registered tools", () => {
    const tools = mcpToolDescriptors();
    for (const tool of tools) {
      expect(TOOL_SCOPES).toHaveProperty(tool.name);
    }
  });

  it("all scopes follow starter.* naming convention", () => {
    for (const [, scopes] of Object.entries(TOOL_SCOPES)) {
      for (const scope of scopes) {
        expect(scope).toMatch(/^starter\./);
      }
    }
  });
});

describe("REQUIRED_SCOPES", () => {
  it("is a deduplicated sorted array of all tool scopes", () => {
    const all = Object.values(TOOL_SCOPES).flat();
    const expected = Array.from(new Set(all)).sort();
    expect(REQUIRED_SCOPES).toEqual(expected);
  });
});

describe("mcpToolDescriptors", () => {
  it("returns valid MCP tool descriptors", () => {
    const tools = mcpToolDescriptors();
    expect(tools.length).toBeGreaterThan(0);

    for (const tool of tools) {
      expect(tool).toHaveProperty("name");
      expect(tool).toHaveProperty("description");
      expect(tool).toHaveProperty("inputSchema");
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  it("includes core tools", () => {
    const names = mcpToolDescriptors().map((t) => t.name);
    expect(names).toContain("whoami");
    expect(names).toContain("echo");
    expect(names).toContain("crmInit");
    expect(names).toContain("crmGetSalesSummary");
  });
});

describe("summarizeToolResult", () => {
  it("summarizes echo", () => {
    expect(summarizeToolResult("echo", { message: "hello" })).toBe("Echo: hello");
  });

  it("summarizes seedMyNotes", () => {
    const result = summarizeToolResult("seedMyNotes", { seeded: [1, 2, 3] });
    expect(result).toBe("Seeded 3 notes.");
  });

  it("summarizes listMyNotes", () => {
    const result = summarizeToolResult("listMyNotes", { notes: [{}, {}] });
    expect(result).toBe("You have 2 notes.");
  });

  it("summarizes crmGetSalesSummary", () => {
    const result = summarizeToolResult("crmGetSalesSummary", {
      summary: { quarter: 2, year: 2025, revenue_cents: 150000, deals_won: 5 },
    });
    expect(result).toContain("Q2 2025");
    expect(result).toContain("$1500");
    expect(result).toContain("5 won deals");
  });

  it("handles unknown tool gracefully", () => {
    expect(summarizeToolResult("unknownTool", {})).toBe("Tool 'unknownTool' completed.");
  });
});
