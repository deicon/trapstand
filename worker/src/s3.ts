import { AwsV4Signer } from "aws4fetch";
import type { Env } from "./index";

export class S3Client {
  constructor(private readonly env: Env) {}

  async objectKey(readToken: string): Promise<string> {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(readToken));
    const hex = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `${hex}/trapstand.json`;
  }

  async put(readToken: string, body: string): Promise<Response> {
    const key = await this.objectKey(readToken);
    const url = `${this.env.S3_ENDPOINT}/${this.env.S3_BUCKET}/${key}`;
    const signer = new AwsV4Signer({
      url,
      method: "PUT",
      body,
      headers: { "Content-Type": "application/json" },
      accessKeyId: this.env.S3_ACCESS_KEY_ID,
      secretAccessKey: this.env.S3_SECRET_ACCESS_KEY,
      service: "s3"
    });
    const signed = await signer.sign();
    return fetch(signed);
  }

  async get(readToken: string): Promise<Response> {
    const key = await this.objectKey(readToken);
    const url = `${this.env.S3_ENDPOINT}/${this.env.S3_BUCKET}/${key}`;
    const signer = new AwsV4Signer({
      url,
      method: "GET",
      accessKeyId: this.env.S3_ACCESS_KEY_ID,
      secretAccessKey: this.env.S3_SECRET_ACCESS_KEY,
      service: "s3"
    });
    const signed = await signer.sign();
    return fetch(signed);
  }
}
