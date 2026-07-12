import { describe, it, expect, beforeAll } from "vitest";
import worker, { type Env } from "./index";

describe("worker routing", () => {
  const env: Env = {
    CLUB_WRITE_TOKEN: "write-secret",
    CLUB_READ_TOKEN: "read-secret",
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
});
