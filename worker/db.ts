import type { EvidenceStorage } from "./storage";

export type AppEnv = {
  DB: D1Database;
  ASSETS: Fetcher;
  RANTAI_SALT?: string;
  RANTAI_SIGNING_KEY?: string;
  RANTAI_BLIND_KEY?: string;
  RANTAI_ENV?: string;
  STORE?: EvidenceStorage;
};

export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID().replace(/-/g, "");
export const shortId = (p: string) => p + "-" + uid().slice(0, 6);

export async function all<T = Record<string, unknown>>(db: D1Database, sql: string, ...args: unknown[]): Promise<T[]> {
  const r = await db.prepare(sql).bind(...args).all();
  return (r.results ?? []) as T[];
}

export async function first<T = Record<string, unknown>>(db: D1Database, sql: string, ...args: unknown[]): Promise<T | null> {
  return (await db.prepare(sql).bind(...args).first()) as T | null;
}

export async function run(db: D1Database, sql: string, ...args: unknown[]) {
  return await db.prepare(sql).bind(...args).run();
}

export async function getSetting(db: D1Database, key: string, def = ""): Promise<string> {
  const row = await first<{ value: string }>(db, `SELECT value FROM settings WHERE key=?`, key);
  return row?.value ?? def;
}

export async function setSetting(db: D1Database, key: string, value: string) {
  await run(db, `INSERT INTO settings(key,value) VALUES(?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value`, key, value);
}

export function boolInt(b: boolean) {
  return b ? 1 : 0;
}

export const SESSION_TTL_SECONDS = 60 * 60 * 8;

export async function createSession(db: D1Database, userId: string, ttlSeconds = SESSION_TTL_SECONDS) {
  const token = uid() + uid();
  const expires = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await run(db, `INSERT INTO sessions(token,user_id,created_at,expires_at) VALUES(?,?,?,?)`,
    token, userId, now(), expires);
  return { token, expires };
}

export async function deleteSession(db: D1Database, token: string) {
  await run(db, `DELETE FROM sessions WHERE token=?`, token);
}

export async function deleteUserSessions(db: D1Database, userId: string) {
  await run(db, `DELETE FROM sessions WHERE user_id=?`, userId);
}

export async function userBySession(db: D1Database, token: string): Promise<any | null> {
  return await first(
    db,
    `SELECT u.id,u.username,u.name,u.role,u.unit FROM sessions s
     JOIN users u ON u.id=s.user_id
     WHERE s.token=? AND (s.expires_at IS NULL OR s.expires_at > ?)`,
    token, now()
  );
}
