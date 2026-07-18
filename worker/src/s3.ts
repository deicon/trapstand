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

  async liveObjectKey(liveToken: string): Promise<string> {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(liveToken));
    const hex = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `live/${hex}.json`;
  }

  async put(readToken: string, body: string): Promise<Response> {
    const key = await this.objectKey(readToken);
    return this.putObject(key, body);
  }

  async get(readToken: string): Promise<Response> {
    const key = await this.objectKey(readToken);
    return this.getObject(key);
  }

  async putLive(liveToken: string, body: string): Promise<Response> {
    const key = await this.liveObjectKey(liveToken);
    return this.putObject(key, body);
  }

  async getLive(liveToken: string): Promise<Response> {
    const key = await this.liveObjectKey(liveToken);
    return this.getObject(key);
  }

  async deleteBackup(readToken: string): Promise<Response> {
    const key = await this.objectKey(readToken);
    return this.deleteObject(key);
  }

  async deleteLive(liveToken: string): Promise<Response> {
    const key = await this.liveObjectKey(liveToken);
    return this.deleteObject(key);
  }

  private async deleteObject(key: string): Promise<Response> {
    const url = `${this.env.S3_ENDPOINT}/${this.env.S3_BUCKET}/${key}`;
    const signer = new AwsV4Signer({
      url,
      method: "DELETE",
      accessKeyId: this.env.S3_ACCESS_KEY_ID,
      secretAccessKey: this.env.S3_SECRET_ACCESS_KEY,
      service: "s3"
    });
    const signed = await signer.sign();
    return fetch(signed.url.toString(), {
      method: signed.method,
      headers: signed.headers,
      body: signed.body
    });
  }

  private async putObject(key: string, body: string): Promise<Response> {
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
    return fetch(signed.url.toString(), {
      method: signed.method,
      headers: signed.headers,
      body: signed.body
    });
  }

  private async getObject(key: string): Promise<Response> {
    const url = `${this.env.S3_ENDPOINT}/${this.env.S3_BUCKET}/${key}`;
    const signer = new AwsV4Signer({
      url,
      method: "GET",
      accessKeyId: this.env.S3_ACCESS_KEY_ID,
      secretAccessKey: this.env.S3_SECRET_ACCESS_KEY,
      service: "s3"
    });
    const signed = await signer.sign();
    return fetch(signed.url.toString(), {
      method: signed.method,
      headers: signed.headers,
      body: signed.body
    });
  }
}
