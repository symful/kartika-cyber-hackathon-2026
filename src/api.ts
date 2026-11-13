export type ApiError = Error & { status?: number };

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const base = "/api";

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const method = (opts.method ?? "GET").toUpperCase();
  if (["POST", "PATCH", "DELETE"].includes(method)) {
    const match = document.cookie.match(/(?:^|;\s*)rantai_csrf=([^;]+)/);
    const headers = new Headers(opts.headers);
    if (match) headers.set("X-CSRF-Token", decodeURIComponent(match[1]));
    opts = { ...opts, headers };
  }
  const res = await fetch(base + path, { credentials: "include", ...opts });
  const ct = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    let msg: string = res.statusText;
    try {
      if (ct.includes("json")) {
        const data = (await res.json()) as { error?: string };
        msg = data.error ?? msg;
      } else {
        msg = await res.text();
      }
    } catch {
      /* keep status text */
    }
    const err = new Error(msg) as ApiError;
    err.status = res.status;
    throw err;
  }
  if (ct.includes("json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export const api = {
  get: <T>(path: string) => req<T>(path),
  post: <T>(path: string, body?: unknown) =>
    req<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    req<T>(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) }),
  upload: <T>(incidentId: string, files: File[], scope: string, note: string) => {
    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    fd.append("share_scope", scope);
    fd.append("note", note);
    return req<T>(`/incidents/${incidentId}/artifacts`, { method: "POST", body: fd });
  },
};

export function download(filename: string, content: string, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
