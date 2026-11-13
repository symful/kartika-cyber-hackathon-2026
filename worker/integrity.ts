const enc = new TextEncoder();
const buf = (u: Uint8Array): BufferSource => u as unknown as BufferSource;

export function bytes(input: string | ArrayBuffer | Uint8Array): Uint8Array {
  if (typeof input === "string") return enc.encode(input);
  if (input instanceof Uint8Array) return input;
  return new Uint8Array(input);
}

export function toHex(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const x of b) s += x.toString(16).padStart(2, "0");
  return s;
}

export function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function sha256Hex(input: string | ArrayBuffer | Uint8Array): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", buf(bytes(input))));
}

export async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", buf(bytes(secret)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, buf(bytes(msg))));
}

export async function pbkdf2Hex(password: string, salt: string, iterations = 60000): Promise<string> {
  const key = await crypto.subtle.importKey("raw", buf(bytes(password)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: buf(bytes(salt)), iterations, hash: "SHA-256" },
    key,
    256
  );
  return toHex(bits);
}

export function b64(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

export function unb64(s: string): Uint8Array {
  const raw = atob(s);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function canonical(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  const obj = v as Record<string, unknown>;
  return (
    "{" +
    Object.keys(obj)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonical(obj[k]))
      .join(",") +
    "}"
  );
}

// ---- Ed25519 checkpoints (WebCrypto, supported by workerd) ----

export type KeyPairB64 = { privateKey: string; publicKey: string };

const ED25519 = { name: "Ed25519" } as unknown as AlgorithmIdentifier;

export async function generateSigningKey(): Promise<KeyPairB64> {
  const kp = (await crypto.subtle.generateKey(ED25519, true, ["sign", "verify"])) as CryptoKeyPair;
  const priv = await crypto.subtle.exportKey("pkcs8", kp.privateKey);
  const pub = await crypto.subtle.exportKey("raw", kp.publicKey);
  return { privateKey: b64(priv), publicKey: b64(pub) };
}

export async function signB64(privateKeyB64: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("pkcs8", buf(unb64(privateKeyB64)), ED25519, false, ["sign"]);
  return b64(await crypto.subtle.sign(ED25519, key, buf(bytes(msg))));
}

export async function verifyB64(publicKeyB64: string, msg: string, sigB64: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("raw", buf(unb64(publicKeyB64)), ED25519, false, ["verify"]);
    return await crypto.subtle.verify(ED25519, key, buf(unb64(sigB64)), buf(bytes(msg)));
  } catch {
    return false;
  }
}

export function fingerprint(pubB64: string): string {
  // Synchronous short fingerprint is not available from subtle; caller hashes async.
  return pubB64.slice(0, 16);
}

export async function merkleRoot(hashes: string[]): Promise<string> {
  if (hashes.length === 0) return "";
  let level = [...hashes].sort();
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 === level.length) {
        next.push(level[i]);
      } else {
        next.push(await sha256Hex(level[i] + level[i + 1]));
      }
    }
    level = next;
  }
  return level[0];
}
