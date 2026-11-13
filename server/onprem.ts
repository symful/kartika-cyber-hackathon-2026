import { mkdirSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { api } from "../worker/api";
import type { EvidenceStorage } from "../worker/storage";

type SqliteStmt = {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): { lastInsertRowid: number | bigint; changes: number | bigint };
};

type SqliteLike = {
  prepare(sql: string): SqliteStmt;
  exec(sql: string): void;
};

class D1Statement {
  constructor(private db: SqliteLike, private sql: string, private params: unknown[] = []) {}

  bind(...args: unknown[]) {
    return new D1Statement(this.db, this.sql, args);
  }

  async all() {
    return { results: this.db.prepare(this.sql).all(...this.params), success: true };
  }

  async first() {
    return this.db.prepare(this.sql).get(...this.params) ?? null;
  }

  async run() {
    const result = this.db.prepare(this.sql).run(...this.params);
    return {
      success: true,
      meta: { last_row_id: Number(result.lastInsertRowid), changes: Number(result.changes) },
    };
  }
}

class D1Shim {
  constructor(private db: SqliteLike) {}
  prepare(sql: string) {
    return new D1Statement(this.db, sql);
  }
  exec(sql: string) {
    this.db.exec(sql);
  }
}

class FilesystemStorage implements EvidenceStorage {
  constructor(private dir: string) {}

  private file(id: string) {
    return path.join(this.dir, id);
  }

  async put(id: string, data: Uint8Array) {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.file(id), data);
  }

  async get(id: string) {
    try {
      return new Uint8Array(await readFile(this.file(id)));
    } catch {
      return null;
    }
  }

  async delete(id: string) {
    try {
      await unlink(this.file(id));
    } catch {
      /* already gone */
    }
  }
}

const dataDir = path.resolve(process.env.DATA_DIR ?? "./data");
mkdirSync(dataDir, { recursive: true });

const sqlite = new DatabaseSync(path.join(dataDir, "rantai.db")) as unknown as SqliteLike;
const db = new D1Shim(sqlite);
const store = new FilesystemStorage(path.join(dataDir, "evidence"));

const env = {
  DB: db,
  ASSETS: null,
  STORE: store,
  RANTAI_ENV: process.env.RANTAI_ENV,
  RANTAI_SIGNING_KEY: process.env.RANTAI_SIGNING_KEY,
  RANTAI_BLIND_KEY: process.env.RANTAI_BLIND_KEY,
  RANTAI_SALT: process.env.RANTAI_SALT,
};

const app = new Hono();
app.route("/api", api);
app.use("*", serveStatic({ root: "./dist" }));
app.get("*", serveStatic({ path: "./dist/index.html" }));

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: (req) => app.fetch(req, env), port }, (info) => {
  console.log(`RANTAI on-prem listening on http://localhost:${info.port}`);
  console.log(`data=${dataDir} evidence=${path.join(dataDir, "evidence")}`);
});
