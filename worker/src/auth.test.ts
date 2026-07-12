import { describe, it, expect } from "vitest";
import { validateToken, extractToken } from "./auth";

describe("validateToken", () => {
  it("returns 'write' for write token", () => {
    expect(validateToken("write-secret", "write-secret", "read-secret")).toBe("write");
  });

  it("returns 'read' for read token", () => {
    expect(validateToken("read-secret", "write-secret", "read-secret")).toBe("read");
  });

  it("returns null for invalid token", () => {
    expect(validateToken("wrong", "write-secret", "read-secret")).toBeNull();
  });
});

describe("extractToken", () => {
  it("extracts Bearer token from header", () => {
    const request = new Request("https://example.com/data", {
      headers: { Authorization: "Bearer read-secret" }
    });
    expect(extractToken(request)).toBe("read-secret");
  });

  it("extracts token from query string", () => {
    const request = new Request("https://example.com/rangliste?token=read-secret");
    expect(extractToken(request)).toBe("read-secret");
  });

  it("returns null when token missing", () => {
    const request = new Request("https://example.com/data");
    expect(extractToken(request)).toBeNull();
  });
});
