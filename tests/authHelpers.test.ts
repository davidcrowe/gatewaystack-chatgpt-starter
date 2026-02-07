import { describe, it, expect, vi } from "vitest";

// Must set env before importing modules that read OAUTH_ISSUER at load time
vi.stubEnv("OAUTH_ISSUER", "https://test.us.auth0.com");

const { readAuth, b64urlDecodeToJson, requireScopes, subjectToUid } =
  await import("../src/handlers/authHelpers.js");

describe("readAuth", () => {
  const mockReq = (authorization?: string) =>
    ({ header: (name: string) => (name === "authorization" ? authorization : undefined) }) as any;

  it("detects Bearer JWT token", () => {
    const result = readAuth(mockReq("Bearer eyJ.eyJ.sig"));
    expect(result.hasAuth).toBe(true);
    expect(result.tokenShape).toBe("jwt");
    expect(result.len).toBeGreaterThan(0);
  });

  it("detects missing auth", () => {
    const result = readAuth(mockReq(""));
    expect(result.hasAuth).toBe(false);
    expect(result.tokenShape).toBe("none");
    expect(result.len).toBe(0);
  });

  it("detects opaque token", () => {
    const result = readAuth(mockReq("Bearer some-opaque-token"));
    expect(result.hasAuth).toBe(true);
    expect(result.tokenShape).toBe("opaque");
  });
});

describe("b64urlDecodeToJson", () => {
  it("decodes valid base64url JSON", () => {
    const payload = { sub: "user123", scope: "openid" };
    const encoded = Buffer.from(JSON.stringify(payload))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(b64urlDecodeToJson(encoded)).toEqual(payload);
  });

  it("returns undefined for invalid input", () => {
    expect(b64urlDecodeToJson("not-valid-json!!!")).toBeUndefined();
  });
});

describe("requireScopes", () => {
  it("passes when all scopes present", () => {
    expect(() => requireScopes(["openid", "starter.echo", "starter.whoami"], ["starter.echo"])).not.toThrow();
  });

  it("throws when scope missing", () => {
    expect(() => requireScopes(["openid"], ["starter.echo"])).toThrow("insufficient_scope");
  });

  it("throws with correct status code", () => {
    try {
      requireScopes([], ["starter.crm"]);
    } catch (e: any) {
      expect(e.status).toBe(403);
      expect(e.code).toBe("INSUFFICIENT_SCOPE");
    }
  });

  it("passes with empty need array", () => {
    expect(() => requireScopes(["openid"], [])).not.toThrow();
  });
});

describe("subjectToUid", () => {
  it("maps Auth0 subject to uid", async () => {
    const uid = await subjectToUid("auth0|abc123");
    expect(uid).toBe("auth0:auth0|abc123");
  });
});
