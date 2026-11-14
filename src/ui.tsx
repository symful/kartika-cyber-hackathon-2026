import React from "react";

const paths: Record<string, React.ReactNode> = {
  shield: <path d="M12 3l7.5 3v5.2c0 4.7-3.1 8.3-7.5 10.3-4.4-2-7.5-5.6-7.5-10.3V6L12 3z" />,
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3l9 16H3L12 3z" />
      <path d="M12 9v5" />
      <path d="M12 17.5v.01" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
      <path d="M14 3v5h5" />
    </>
  ),
  check: <path d="M4 12.5l5 5L20 6.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  upload: (
    <>
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 20h16" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M4 20h16" />
    </>
  ),
  fingerprint: (
    <>
      <path d="M12 4a8 8 0 0 0-8 8v2" />
      <path d="M20 14v-2a8 8 0 0 0-4-6.9" />
      <path d="M7 12a5 5 0 0 1 10 0v3a4 4 0 0 0 1 2.6" />
      <path d="M12 9a3 3 0 0 1 3 3v4" />
      <path d="M9 12a3 3 0 0 1 1-2.2" />
      <path d="M9 16v2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5.8" />
      <path d="M18 20a5.5 5.5 0 0 0-3-4.9" />
    </>
  ),
  logout: (
    <>
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
      <path d="M15 8l4 4-4 4" />
      <path d="M19 12H9" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l4 4" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V8a4 4 0 0 1 8 0v2" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
      <path d="M3 17.5l9 5 9-5" />
    </>
  ),
  zap: <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" />
    </>
  ),
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  play: <path d="M8 5l11 7-11 7V5z" />,
  pause: (
    <>
      <path d="M9 5v14M15 5v14" />
    </>
  ),
  pivot: (
    <>
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="18" cy="18" r="2.4" />
      <path d="M8.4 6H13a3 3 0 0 1 3 3v3" />
      <path d="M15.6 18H11a3 3 0 0 1-3-3v-3" />
    </>
  ),
  menu: (
    <>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </>
  ),
  chain: (
    <>
      <path d="M10 13a4.5 4.5 0 0 0 6.4 0l2.1-2.1a4.5 4.5 0 0 0-6.4-6.4L11 5.6" />
      <path d="M14 11a4.5 4.5 0 0 0-6.4 0l-2.1 2.1a4.5 4.5 0 0 0 6.4 6.4l1.1-1.1" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5.5" rx="8" ry="3" />
      <path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13" />
      <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l8-8M16 4l4 4M14 9l3 3" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </>
  ),
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8L3 5z" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="1.5" />
      <path d="M15 9V5.5A1.5 1.5 0 0 0 13.5 4h-8A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15H9" />
    </>
  ),
};

export function Icon({ name, size = 18, className = "", style }: { name: string; size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={"icon " + className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name] ?? null}
    </svg>
  );
}

export function Stamp({
  tone,
  rotate,
  large,
  children,
  title,
}: {
  tone?: "green" | "amber" | "orange" | "ink" | "signal";
  rotate?: 1 | 2;
  large?: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      className={cls("stamp", tone && tone !== "signal" ? tone : "", rotate === 1 ? "r1" : rotate === 2 ? "r2" : "", large && "lg")}
      title={title}
    >
      {children}
    </span>
  );
}

export function LoadingBlock({
  label = "Memuat data",
  stats = false,
  rows = 5,
}: {
  label?: string;
  stats?: boolean;
  rows?: number;
}) {
  return (
    <div aria-busy="true" aria-live="polite">
      {stats && (
        <div className="sk-row">
          {[0, 1, 2, 3].map((n) => (
            <div className="sk-cell" key={n} />
          ))}
        </div>
      )}
      <div className="skeleton">
        <div className="sk-line title" />
        {Array.from({ length: rows }).map((_, i) => (
          <div className={cls("sk-line", i % 3 === 0 ? "w95" : i % 3 === 1 ? "w80" : "w60")} key={i} />
        ))}
      </div>
      <div className="loading-screen" style={{ minHeight: 0, paddingTop: 16 }}>
        <span className="spinner" />
        <span className="mono">{label}</span>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorState({
  title,
  message,
  status,
  onRetry,
  children,
}: {
  title?: string;
  message: string;
  status?: number;
  onRetry?: () => void;
  children?: React.ReactNode;
}) {
  const heading =
    status === 403
      ? "Akses ditolak"
      : status === 404
        ? "Berkas tidak ditemukan"
        : status === 429
          ? "Permintaan dibatasi"
          : title ?? "Data gagal dimuat";
  const explanation =
    status === 403
      ? "Kebijakan akses satuan menolak permintaan ini. Bukti mentah lintas satuan tetap tertutup sampai koordinator menyetujui permintaan akses."
      : status === 404
        ? "Berkas kasus atau artefak ini tidak tersedia pada basis data lokal. Periksa tautan atau kembali ke daftar insiden."
        : status === 429
          ? "Batas percobaan tercapai. Tunggu beberapa menit sebelum mencoba lagi."
          : "Server tidak mengembalikan data yang diminta. Tidak ada tampilan yang disamarkan: pesan asli dari server dicantumkan di bawah.";
  return (
    <div className="error-state" role="alert">
      {status && <span className="stamp code-stamp">HTTP {status}</span>}
      <h3>{heading}</h3>
      <p>{explanation}</p>
      <p className="mono small" style={{ color: "var(--ink-2)", marginTop: 8, wordBreak: "break-word" }}>
        {message}
      </p>
      <div className="inline" style={{ marginTop: 14 }}>
        {onRetry && (
          <button className="btn" onClick={onRetry}>
            <Icon name="activity" size={14} /> Coba lagi
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

export function EmptyState({
  index = "KOSONG",
  title,
  children,
  action,
}: {
  index?: string;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-index">{index}</div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div className="inline" style={{ justifyContent: "center" }}>{action}</div>}
    </div>
  );
}

/**
 * Menahan fokus di dalam panel modal/drawer dan mengembalikannya ke elemen
 * pemicu saat panel ditutup. Escape memanggil onClose terbaru.
 */
export function useFocusTrap<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  onClose?: () => void,
  initialSelector?: string
) {
  const close = React.useRef(onClose);
  close.current = onClose;
  React.useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    if (initialSelector && ref.current) {
      ref.current.querySelector<HTMLElement>(initialSelector)?.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close.current?.();
        return;
      }
      if (e.key !== "Tab" || !ref.current) return;
      const nodes = ref.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const list = Array.from(nodes).filter((el) => el.offsetParent !== null);
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [ref, initialSelector]);
}

export const cls = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");
