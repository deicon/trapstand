export type TokenRole = "write" | "read" | null;

export function validateToken(token: string, writeToken: string, readToken: string): TokenRole {
  if (timingSafeEqual(token, writeToken)) return "write";
  if (timingSafeEqual(token, readToken)) return "read";
  return null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function extractToken(request: Request): string | null {
  const auth = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  if (match) return match[1];

  const url = new URL(request.url);
  return url.searchParams.get("token");
}
