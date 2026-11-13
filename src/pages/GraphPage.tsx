import { useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "../api";
import { Icon } from "../ui";
import type { Goto, GraphData, GraphNode, Notify } from "../types";

type Pos = Record<string, { x: number; y: number; node: GraphNode }>;

export default function GraphPage({ goto, notify }: { goto: Goto; notify: Notify }) {
  const [g, setG] = useState<GraphData | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    api.get<GraphData>("/graph").then(setG).catch((e) => notify(errorMessage(e), "error"));
  }, []);

  const layout = useMemo(() => {
    if (!g) return null;
    const W = 960, H = 600, top = 60, bottom = 60;
    const incidents = g.nodes.filter((n) => n.kind === "incident");
    const indicators = g.nodes.filter((n) => n.kind === "indicator");

    const incidentIndex: Record<string, number> = {};
    incidents.forEach((n, i) => (incidentIndex[n.id] = i));

    // Order indicators by the earliest incident they connect to, to reduce crossings.
    const firstRef = (n: GraphNode) => {
      const edges = g.edges.filter((e) => e.to === n.id || e.from === n.id);
      const idx = edges.map((e) => incidentIndex[e.from === n.id ? e.to : e.from] ?? 99);
      return Math.min(...idx, 99);
    };
    indicators.sort((a, b) => firstRef(a) - firstRef(b));

    const gap = (count: number) => (count <= 1 ? 0 : (H - top - bottom) / (count - 1));
    const pos: Pos = {};
    incidents.forEach((n, i) => {
      pos[n.id] = { x: 175, y: top + i * gap(incidents.length), node: n };
    });
    indicators.forEach((n, i) => {
      pos[n.id] = { x: W - 300, y: top + i * gap(indicators.length), node: n };
    });
    return { W, H, pos, incidents, indicators };
  }, [g]);

  if (!g || !layout) {
    return <div className="loading-screen"><span className="spinner" /><div className="small">Menghitung graf korelasi…</div></div>;
  }
  if (g.nodes.length === 0) return <div className="empty">Belum ada data untuk digambarkan.</div>;

  const relatedSet = (id: string) => new Set(g.edges.filter((e) => e.from === id || e.to === id).flatMap((e) => [e.from, e.to]));

  return (
    <div className="fade-up">
      <div className="inline" style={{ justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>Graf korelasi kampanye</div>
          <div className="muted small">Insiden di kiri, indikator bersama di kanan. Hanya pasangan berskor ≥ 45 yang digambar.</div>
        </div>
        <div className="inline" style={{ gap: 14 }}>
          <span className="small"><span className="dot" style={{ background: "var(--accent)", display: "inline-block", marginRight: 6 }} />Insiden</span>
          <span className="small"><span className="dot" style={{ background: "var(--teal)", display: "inline-block", marginRight: 6 }} />Indikator</span>
        </div>
      </div>

      <div className="card graph-wrap">
        <svg viewBox={`0 0 ${layout.W} ${layout.H}`} width="100%" style={{ display: "block" }}>
          <defs>
            <radialGradient id="glow" cx="50%" cy="45%" r="60%">
              <stop offset="0%" stopColor="#16253f" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#0a1120" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width={layout.W} height={layout.H} fill="url(#glow)" />

          <text x="175" y="26" textAnchor="middle" style={{ fill: "var(--faint)", fontSize: 10, letterSpacing: "0.14em" }}>INSIDEN</text>
          <text x={layout.W - 300} y="26" textAnchor="middle" style={{ fill: "var(--faint)", fontSize: 10, letterSpacing: "0.14em" }}>INDIKATOR BERSAMA</text>

          {g.edges.map((e, i: number) => {
            const a = layout.pos[e.from], b = layout.pos[e.to];
            if (!a || !b) return null;
            const hot = hover && (e.from === hover || e.to === hover);
            const dim = hover && !hot;
            const bothIncidents = a.node.kind === "incident" && b.node.kind === "incident";
            if (bothIncidents) {
              const ia = layout.incidents.findIndex((n) => n.id === e.from);
              const ib = layout.incidents.findIndex((n) => n.id === e.to);
              const hop = Math.max(1, Math.abs(ia - ib));
              const cx = Math.min(a.x, b.x) - 55 - hop * 55;
              const cy = (a.y + b.y) / 2;
              return (
                <path key={i} d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`} fill="none"
                  className={"graph-edge" + (hot ? " hot" : "")}
                  opacity={dim ? 0.12 : 0.8}
                  strokeWidth={e.weight >= 60 ? 2.2 : 1.2} />
              );
            }
            return (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                className={"graph-edge" + (hot ? " hot" : "")}
                opacity={dim ? 0.12 : 0.85}
                strokeWidth={e.weight >= 60 ? 2.2 : 1.2} />
            );
          })}

          {g.nodes.map((n) => {
            const p = layout.pos[n.id];
            if (!p) return null;
            const isIncident = n.kind === "incident";
            const related = hover ? relatedSet(hover).has(n.id) || hover === n.id : true;
            const isolated = isIncident && !g.edges.some((e) => e.from === n.id || e.to === n.id);
            return (
              <g key={n.id} className="graph-node" transform={`translate(${p.x},${p.y})`}
                opacity={related ? 1 : 0.25}
                style={{ cursor: isIncident ? "pointer" : "default" }}
                onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
                onClick={() => isIncident && goto("incident", n.id)}>
                {isIncident ? (
                  <>
                    <circle r="26" fill="#0e1930" stroke={isolated ? "var(--line)" : n.score >= 70 ? "var(--red)" : "var(--accent)"} strokeWidth="1.8" />
                    <text textAnchor="middle" dy="4" style={{ fontSize: 12, fontWeight: 700, fill: isolated ? "var(--faint)" : n.score >= 70 ? "var(--red)" : "var(--accent)" }}>
                      {Math.round(n.score ?? 0)}
                    </text>
                    <text x="36" dy="-2" style={{ fontSize: 11, fill: "var(--text)", fontWeight: 600 }}>{n.label.split(" · ")[0]}</text>
                    <text x="36" dy="12" style={{ fontSize: 9.5, fill: "var(--faint)" }}>{n.unit}</text>
                    <text x="36" dy="25" style={{ fontSize: 9.5, fill: "var(--faint)" }}>
                      {isolated ? "tidak terkait" : n.label.split(" · ")[1] ?? ""}
                    </text>
                  </>
                ) : (
                  <>
                    <circle r="6" fill="var(--teal)" />
                    <circle r="13" fill="none" stroke="rgba(61,214,196,.45)" strokeWidth="1" />
                    <text x="-22" textAnchor="end" dy="4" style={{ fontSize: 10, fill: "var(--muted)" }}>{n.label}</text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="small faint">Insiden</div>
          <div className="stat-value" style={{ fontSize: 24 }}>{layout.incidents.length}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="small faint">Indikator bersama</div>
          <div className="stat-value" style={{ fontSize: 24 }}>{layout.indicators.length}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="small faint">Tepi korelasi</div>
          <div className="stat-value" style={{ fontSize: 24 }}>{g.edges.length}</div>
        </div>
      </div>

      <div className="disclaimer" style={{ marginTop: 14 }}>
        <Icon name="alert" size={15} />
        <span>
          Simpul tanpa garis adalah laporan yang tidak terbukti terkait. Klik simpul insiden untuk membuka berkas kasus.
        </span>
      </div>
    </div>
  );
}
