import { describe, it, expect, beforeAll } from "vitest";
import { S3Client } from "./s3";
import type { Env } from "./index";

describe("S3Client objectKey", () => {
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
    if (typeof globalThis.crypto === "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).crypto = require("node:crypto").webcrypto;
    }
  });

  it("builds object key from read token hash", async () => {
    const client = new S3Client(env);
    const key = await client.objectKey("read-token");
    expect(key).toMatch(/^[a-f0-9]{64}\/trapstand\.json$/);
  });
});
