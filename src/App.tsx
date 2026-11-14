import { useEffect, useState } from "react";
import { api, type ApiError } from "./api";
import { ErrorState, Icon } from "./ui";
import type { MeResponse, NotifyTone, User } from "./types";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Incidents from "./pages/Incidents";
import IncidentDetail from "./pages/IncidentDetail";
import GraphPage from "./pages/GraphPage";
import AuditPage from "./pages/AuditPage";
import ReportsPage from "./pages/ReportsPage";

export type Route = { name: string; id?: string; sub?: string; extra?: string };

function parseHash(): Route {
  const parts = window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  return { name: parts[0] || "dashboard", id: parts[1], sub: parts[2], extra: parts[3] };
}

const titles: Record<string, { title: string; crumb: string }> = {
  dashboard: { title: "Ringkasan Operasi", crumb: "Operasi / Ringkasan" },
  incidents: { title: "Laporan Insiden", crumb: "Operasi / Daftar Laporan" },
  incident: { title: "Berkas Kasus", crumb: "Operasi / Berkas Kasus" },
  graph: { title: "Graf Korelasi", crumb: "Operasi / Korelasi" },
  audit: { title: "Integritas Bukti", crumb: "Sistem / Rantai Audit" },
  reports: { title: "Ekspor & Laporan", crumb: "Sistem / Keluaran" },
};

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [bootError, setBootError] = useState<ApiError | null>(null);
  const [route, setRoute] = useState<Route>(parseHash());
  const [toast, setToast] = useState<{ msg: string; tone: NotifyTone } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  function boot() {
    setBootError(null);
    setUser(undefined);
    api
      .get<MeResponse>("/me")
      .then((d) => setUser(d.user))
      .catch((e) => setBootError(e as ApiError));
  }

  useEffect(() => {
    boot();
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [route.name, route.id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const notify = (msg: string, tone: NotifyTone = "info") => setToast({ msg, tone });
  const goto = (name: string, id?: string, sub?: string) => {
    const hash = id ? `#/${name}/${id}${sub ? "/" + sub : ""}` : `#/${name}`;
    if (window.location.hash !== hash) window.location.hash = hash;
    setRoute({ name, id, sub });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  if (bootError) {
    return (
      <div style={{ minHeight: "100vh", padding: "10vh 20px", background: "var(--paper)" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div className="brand" style={{ marginBottom: 24 }}>
            <div className="brand-mark" style={{ background: "var(--ink)", borderColor: "var(--ink)", color: "var(--paper)" }}>
              <Icon name="chain" size={18} />
            </div>
            <div>
              <div className="brand-name" style={{ color: "var(--ink)" }}>RANTAI</div>
              <div className="brand-sub" style={{ color: "var(--faint)" }}>Berkas bukti &amp; koordinasi</div>
            </div>
          </div>
          <ErrorState
            title="Ruang kerja tidak dapat dibuka"
            message={bootError.message || "Permintaan sesi gagal."}
            status={bootError.status}
            onRetry={boot}
          >
            <button className="btn primary" onClick={() => { setBootError(null); setUser(null); }}>
              Buka halaman masuk
            </button>
          </ErrorState>
        </div>
      </div>
    );
  }

  if (user === undefined) {
    return (
      <div className="loading-screen">
        <div className="brand-mark" style={{ background: "var(--ink)", borderColor: "var(--ink)", color: "var(--paper)" }}>
          <Icon name="chain" size={18} />
        </div>
        <span className="spinner" />
        <div className="mono">Menyiapkan ruang kerja</div>
      </div>
    );
  }

  if (!user) return <Login onLogin={setUser} />;

  const nav = [
    { name: "dashboard", label: "Ringkasan", icon: "grid" },
    { name: "incidents", label: "Insiden", icon: "alert" },
    { name: "graph", label: "Korelasi", icon: "link" },
    { name: "audit", label: "Integritas", icon: "fingerprint" },
    { name: "reports", label: "Ekspor", icon: "download" },
  ];

  const meta = titles[route.name] ?? { title: "RANTAI", crumb: "Ruang Kerja" };
  const initials = user.name.split(" ").map((x: string) => x[0]).slice(0, 2).join("");

  return (
    <div className="shell">
      <a className="sr-only" href="#main-content">Lewati ke konten</a>
      <aside className={"spine" + (menuOpen ? " open" : "")} id="spine-nav" aria-label="Navigasi utama">
        <div className="spine-brand">
          <div className="brand">
            <div className="brand-mark">
              <Icon name="chain" size={18} />
            </div>
            <div>
              <div className="brand-name">RANTAI</div>
              <div className="brand-sub">Bukti &amp; koordinasi</div>
            </div>
          </div>
        </div>
        <div className="spine-rule" />

        <div className="nav-label">Operasi</div>
        <nav className="nav">
          {nav.map((n) => (
            <button
              key={n.name}
              className={"nav-item" + (route.name === n.name || (n.name === "incidents" && route.name === "incident") ? " active" : "")}
              onClick={() => goto(n.name)}
              aria-current={route.name === n.name ? "page" : undefined}
            >
              <Icon name={n.icon} size={16} />
              {n.label}
            </button>
          ))}
        </nav>

        <div className="nav-label">Sistem</div>
        <div className="nav">
          <div className="nav-item" style={{ cursor: "default" }} title="Tidak ada panggilan keluar saat runtime">
            <Icon name="database" size={16} />
            D1 lokal / offline
          </div>
          <div className="nav-item" style={{ cursor: "default" }}>
            <Icon name="key" size={16} />
            Peran: {user.role === "coordinator" ? "Koordinator" : "Analis"}
          </div>
        </div>

        <div className="spine-foot">
          <div className="user-chip">
            <div className="avatar">{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div className="user-name truncate">{user.name}</div>
              <div className="user-unit truncate">{user.unit}</div>
            </div>
          </div>
          <button
            className="btn ghost"
            onClick={async () => {
              await api.post("/logout");
              setUser(null);
            }}
          >
            <Icon name="logout" size={15} /> Keluar dari sesi
          </button>
        </div>
      </aside>

      {menuOpen && <button className="scrim" aria-label="Tutup navigasi" onClick={() => setMenuOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button
            className="btn ghost menu-btn"
            aria-label={menuOpen ? "Tutup navigasi" : "Buka navigasi"}
            aria-expanded={menuOpen}
            aria-controls="spine-nav"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Icon name={menuOpen ? "x" : "menu"} size={18} />
          </button>
          <div className="topbar-title">
            <div className="crumb">
              <span>{meta.crumb.split(" / ")[0]}</span>
              <span className="sep">/</span>
              <span>{meta.crumb.split(" / ")[1]}</span>
            </div>
            <h1>{meta.title}</h1>
          </div>
          <div className="topbar-right">
            <span className="sys-status" title="Tidak ada panggilan keluar saat runtime">
              <span className="status-dot" />
              <span>Sistem aktif</span>
            </span>
            <span className="unit-tag">{user.unit}</span>
          </div>
        </header>

        <main className="container" id="main-content">
          {route.name === "dashboard" && <Dashboard user={user} goto={goto} notify={notify} />}
          {route.name === "incidents" && <Incidents user={user} goto={goto} notify={notify} />}
          {route.name === "incident" && <IncidentDetail id={route.id!} sub={route.sub} extra={route.extra} user={user} goto={goto} notify={notify} />}
          {route.name === "graph" && <GraphPage goto={goto} notify={notify} />}
          {route.name === "audit" && <AuditPage user={user} notify={notify} />}
          {route.name === "reports" && <ReportsPage notify={notify} />}
        </main>
      </div>

      {toast && (
        <div className={"toast " + toast.tone} role="status" aria-live="polite">
          {toast.msg}
        </div>
      )}
    </div>
  );
}
