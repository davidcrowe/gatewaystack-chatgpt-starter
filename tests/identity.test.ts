import { describe, it, expect, beforeEach, vi } from "vitest";

describe("userKeyFromSubject", () => {
  beforeEach(() => {
    vi.stubEnv("PII_SALT", "test-salt-value");
  });

  it("produces a deterministic 64-char hex key", async () => {
    const { userKeyFromSubject } = await import("../src/demo-api/crm/identity.js");
    const key = userKeyFromSubject("auth0|user123");
    expect(key).toHaveLength(64);
    expect(key).toMatch(/^[0-9a-f]+$/);

    // Deterministic: same input → same output
    expect(userKeyFromSubject("auth0|user123")).toBe(key);
  });

  it("produces different keys for different subjects", async () => {
    const { userKeyFromSubject } = await import("../src/demo-api/crm/identity.js");
    const key1 = userKeyFromSubject("auth0|user1");
    const key2 = userKeyFromSubject("auth0|user2");
    expect(key1).not.toBe(key2);
  });
});

describe("userLabel", () => {
  it("returns a short safe label", async () => {
    const { userLabel } = await import("../src/demo-api/crm/identity.js");
    const label = userLabel("abcdef1234567890");
    expect(label).toBe("user-abcdef");
  });
});
