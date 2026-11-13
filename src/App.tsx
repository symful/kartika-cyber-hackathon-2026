import { useEffect, useState } from "react";
import { api } from "./api";
import { Icon } from "./ui";
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

const titles: Record<string, string> = {
  dashboard: "Ringkasan Operasi",
  incidents: "Laporan Insiden",
  incident: "Detail Insiden",
  graph: "Graf Korelasi",
  audit: "Integritas Bukti",
  reports: "Ekspor & Laporan",
};

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [route, setRoute] = useState<Route>(parseHash());
  const [toast, setToast] = useState<{ msg: string; tone: NotifyTone } | null>(null);

  useEffect(() => {
    api.get<MeResponse>("/me").then((d) => setUser(d.user)).catch(() => setUser(null));
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const notify = (msg: string, tone: NotifyTone = "info") => setToast({ msg, tone });
  const goto = (name: string, id?: string, sub?: string) => {
    const hash = id ? `#/${name}/${id}${sub ? "/" + sub : ""}` : `#/${name}`;
    if (window.location.hash !== hash) window.location.hash = hash;
    setRoute({ name, id, sub });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (user === undefined) {
    return (
      <div className="loading-screen">
        <span className="spinner" />
        <div className="small">Memuat RANTAI…</div>
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

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Icon name="shield" size={19} />
          </div>
          <div>
            <div className="brand-name">RANTAI</div>
            <div className="brand-sub">Evidence · Coordination</div>
          </div>
        </div>

        <div className="nav-label">Operasi</div>
        <nav className="nav">
          {nav.map((n) => (
            <button
              key={n.name}
              className={"nav-item" + (route.name === n.name || (n.name === "incidents" && route.name === "incident") ? " active" : "")}
              onClick={() => goto(n.name)}
            >
              <Icon name={n.icon} size={17} />
              {n.label}
            </button>
          ))}
        </nav>

        <div className="nav-label">Sistem</div>
        <div className="nav">
          <div className="nav-item" style={{ cursor: "default" }}>
            <Icon name="lock" size={17} />
            Offline · D1 lokal
          </div>
          <div className="nav-item" style={{ cursor: "default" }}>
            <Icon name="zap" size={17} />
            Peran: {user.role === "coordinator" ? "Koordinator" : "Analis"}
          </div>
        </div>

        <div className="sidebar-foot">
          <div className="user-chip">
            <div className="avatar">{user.name.split(" ").map((x: string) => x[0]).slice(0, 2).join("")}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 12.5 }} className="truncate">{user.name}</div>
              <div className="faint small truncate">{user.unit}</div>
            </div>
          </div>
          <button
            className="btn ghost"
            style={{ width: "100%", marginTop: 6, justifyContent: "flex-start" }}
            onClick={async () => {
              await api.post("/logout");
              setUser(null);
            }}
          >
            <Icon name="logout" size={15} /> Keluar
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <div className="page-title">{titles[route.name] ?? "RANTAI"}</div>
            <div className="crumb">Kategori Penangkalan · Kartika Cyber Hackathon 2026</div>
          </div>
          <div className="topbar-right">
            <span className="badge green">
              <span className="dot" /> Sistem aktif
            </span>
            <span className="badge neutral">{user.unit}</span>
          </div>
        </header>

        <main className="container">
          {route.name === "dashboard" && <Dashboard user={user} goto={goto} notify={notify} />}
          {route.name === "incidents" && <Incidents user={user} goto={goto} notify={notify} />}
          {route.name === "incident" && <IncidentDetail id={route.id!} sub={route.sub} extra={route.extra} user={user} goto={goto} notify={notify} />}
          {route.name === "graph" && <GraphPage goto={goto} notify={notify} />}
          {route.name === "audit" && <AuditPage user={user} notify={notify} />}
          {route.name === "reports" && <ReportsPage notify={notify} />}
        </main>
      </div>

      {toast && <div className={"toast " + toast.tone}>{toast.msg}</div>}
    </div>
  );
}
