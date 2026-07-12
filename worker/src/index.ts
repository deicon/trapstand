import { extractToken, validateToken } from "./auth";
import { corsHeaders, withCors } from "./cors";
import { S3Client } from "./s3";

export interface Env {
  CLUB_WRITE_TOKEN: string;
  CLUB_READ_TOKEN: string;
  S3_ENDPOINT: string;
  S3_REGION: string;
  S3_BUCKET: string;
  S3_ACCESS_KEY_ID: string;
  S3_SECRET_ACCESS_KEY: string;
  PWA_ORIGIN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env, request) });
    }

    if (url.pathname === "/ping") {
      return new Response("pong", { status: 200 });
    }

    if (url.pathname === "/sync" && request.method === "POST") {
      const token = extractToken(request);
      const role = token ? validateToken(token, env.CLUB_WRITE_TOKEN, env.CLUB_READ_TOKEN) : null;
      if (role !== "write") {
        return withCors(new Response("Unauthorized", { status: 401 }), env, request);
      }
      const body = await request.text();
      const s3 = new S3Client(env);
      const result = await s3.put(env.CLUB_READ_TOKEN, body);
      if (!result.ok) {
        return withCors(new Response("S3 error", { status: 500 }), env, request);
      }
      return withCors(new Response(null, { status: 204 }), env, request);
    }

    if (url.pathname === "/data" && request.method === "GET") {
      const token = extractToken(request);
      const role = token ? validateToken(token, env.CLUB_WRITE_TOKEN, env.CLUB_READ_TOKEN) : null;
      if (role !== "read" && role !== "write") {
        return withCors(new Response("Unauthorized", { status: 401 }), env, request);
      }
      const s3 = new S3Client(env);
      const result = await s3.get(env.CLUB_READ_TOKEN);
      if (result.status === 404) {
        return withCors(new Response("Not found", { status: 404 }), env, request);
      }
      if (!result.ok) {
        return withCors(new Response("S3 error", { status: 500 }), env, request);
      }
      const body = await result.text();
      return withCors(new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate"
        }
      }), env, request);
    }

    return new Response("Not found", { status: 404 });
  }
};
