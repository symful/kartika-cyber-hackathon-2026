import { getCookie, setCookie } from "hono/cookie";

export const SESSION_TTL_SECONDS = 60 * 60 * 8;

const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return true;
}

export function clientIP(c: any): string {
  return c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "local";
}

export function csrfToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function ensureCsrfCookie(c: any, secure: boolean): string {
  let token = getCookie(c, "rantai_csrf");
  if (!token) {
    token = csrfToken();
    setCookie(c, "rantai_csrf", token, {
      httpOnly: false,
      sameSite: "Lax",
      path: "/",
      maxAge: 60 * 60 * 8,
      secure,
    });
  }
  return token;
}

export function csrfOk(c: any): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(c.req.method.toUpperCase())) return true;
  if (c.req.path.endsWith("/login") || c.req.path.endsWith("/dev/login")) return true;
  const cookie = getCookie(c, "rantai_csrf");
  const header = c.req.header("x-csrf-token");
  return !!cookie && !!header && cookie === header;
}

export type Actor = { username: string; role: string; unit: string };

export function ownsIncident(actor: Actor, unit: string): boolean {
  return actor.role === "coordinator" || actor.unit === unit;
}

export function canWriteIncident(actor: Actor, unit: string): boolean {
  return ownsIncident(actor, unit);
}

/** TLP 2.0 gates sharing. Internal `share_scope` remains a separate policy. */
export function tlpAllowsRaw(tlp: string, sameUnit: boolean, approved: boolean): boolean {
  const label = (tlp || "amber").toLowerCase();
  if (sameUnit) return true;
  switch (label) {
    case "clear":
    case "green":
      return true;
    case "amber":
      return approved;
    case "amber+strict":
    case "red":
      return false;
    default:
      return approved;
  }
}

export function tlpAllowsMetadata(tlp: string): boolean {
  return (tlp || "amber").toLowerCase() !== "red";
}
