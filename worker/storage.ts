export interface EvidenceStorage {
  put(id: string, data: Uint8Array): Promise<void>;
  get(id: string): Promise<Uint8Array | null>;
  delete(id: string): Promise<void>;
}

/** Default provider: content-addressed artefacts stored as D1 BLOBs. */
export function d1Storage(db: D1Database): EvidenceStorage {
  return {
    async put(id, data) {
      await db.prepare(`UPDATE artifacts SET content=? WHERE id=?`).bind(data, id).run();
    },
    async get(id) {
      const row = (await db.prepare(`SELECT content FROM artifacts WHERE id=?`).bind(id).first()) as
        | { content?: ArrayBuffer | Uint8Array | null }
        | null;
      if (!row?.content) return null;
      return row.content instanceof Uint8Array ? row.content : new Uint8Array(row.content);
    },
    async delete(id) {
      await db.prepare(`UPDATE artifacts SET content=NULL WHERE id=?`).bind(id).run();
    },
  };
}

export function storageFor(env: { DB: D1Database; STORE?: EvidenceStorage }): EvidenceStorage {
  return env.STORE ?? d1Storage(env.DB);
}
