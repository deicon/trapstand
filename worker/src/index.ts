import { corsHeaders } from "./cors";

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

    return new Response("Not found", { status: 404 });
  }
};
