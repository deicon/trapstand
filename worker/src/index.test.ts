import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import worker, { type Env } from "./index";

describe("worker routing", () => {
  const env: Env = {
    CLUB_WRITE_TOKEN: "write-secret",
    CLUB_READ_TOKEN: "read-secret",
    LIVE_TOKEN: "live-secret",
    S3_ENDPOINT: "https://s3.example.com",
    S3_REGION: "nbg1",
    S3_BUCKET: "trapstand",
    S3_ACCESS_KEY_ID: "key",
    S3_SECRET_ACCESS_KEY: "secret",
    PWA_ORIGIN: "*"
  };

  beforeAll(() => {
    // Vitest node environment does not expose Web Crypto globally by default.
    if (typeof globalThis.crypto === "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).crypto = require("node:crypto").webcrypto;
    }
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 404 for unknown paths", async () => {
    const request = new Request("https://trapstand.example.com/unknown");
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(404);
  });

  it("returns HTML for /rangliste", async () => {
    const request = new Request("https://trapstand.example.com/rangliste?token=read-secret");
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
  });

  it("returns pong for /ping", async () => {
    const request = new Request("https://trapstand.example.com/ping");
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("pong");
  });

  it("returns HTML for /live with valid token", async () => {
    const request = new Request("https://trapstand.example.com/live?token=live-secret");
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
  });

  it("returns 401 for /live without token", async () => {
    const request = new Request("https://trapstand.example.com/live");
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(401);
  });

  it("returns 401 for /live with invalid token", async () => {
    const request = new Request("https://trapstand.example.com/live?token=wrong");
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(401);
  });

  it("publishes live round data with write token", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const request = new Request("https://trapstand.example.com/live", {
      method: "POST",
      headers: { Authorization: "Bearer write-secret", "Content-Type": "application/json" },
      body: JSON.stringify({ id: "runde-1" })
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(204);
  });

  it("rejects live publish without write token", async () => {
    const request = new Request("https://trapstand.example.com/live", {
      method: "POST",
      headers: { Authorization: "Bearer read-secret", "Content-Type": "application/json" },
      body: JSON.stringify({ id: "runde-1" })
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(401);
  });
});
