import type { Env } from "./index";

export function corsHeaders(env: Env, request: Request): Record<string, string> {
  const origin = env.PWA_ORIGIN === "*" ? "*" : env.PWA_ORIGIN;
  const requestOrigin = request.headers.get("Origin") ?? origin;
  return {
    "Access-Control-Allow-Origin": env.PWA_ORIGIN === "*" ? "*" : requestOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}

export function withCors(response: Response, env: Env, request: Request): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(env, request))) {
    headers.set(key, value);
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
