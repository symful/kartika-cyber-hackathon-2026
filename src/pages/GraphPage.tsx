import { useEffect, useMemo, useState } from "react";
import { api, errorMessage, type ApiError } from "../api";
import { EmptyState, ErrorState, Icon, LoadingBlock } from "../ui";
import type { Goto, GraphData, GraphNode, Notify } from "../types";

type Pos = Record<string, { x: number; y: number; node: GraphNode }>;

export default function GraphPage({ goto, notify }: { goto: Goto; notify: Notify }) {
  const [g, setG] = useState<GraphData | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  function load() {
    setG(null);
    setError(null);
    api
      .get<GraphData>("/graph")
      .then(setG)
      .catch((e: ApiError) => {
        setError(e);
        notify(errorMessage(e), "error");
      });
  }

  useEffect(() => {
    load();
  }, []);

  const layout = useMemo(() => {
    if (!g) return null;
    const W = 1000;
    const H = 620;
    const top = 58;
    const bottom = 58;
    const incidents = g.nodes.filter((n) => n.kind === "incident");
    const indicators = g.nodes.filter((n) => n.kind === "indicator");

    const incidentIndex: Record<string, number> = {};
    incidents.forEach((n, i) => (incidentIndex[n.id] = i));

    const firstRef = (n: GraphNode) => {
      const edges = g.edges.filter((e) => e.to === n.id || e.from === n.id);
      const idx = edges.map((e) => incidentIndex[e.from === n.id ? e.to : e.from] ?? 99);
      return Math.min(...idx, 99);
    };
    indicators.sort((a, b) => firstRef(a) - firstRef(b));

    const gap = (count: number) => (count <= 1 ? 0 : (H - top - bottom) / (count - 1));
    const pos: Pos = {};
    incidents.forEach((n, i) => {
      pos[n.id] = { x: 185, y: top + i * gap(incidents.length), node: n };
    });
    indicators.forEach((n, i) => {
      pos[n.id] = { x: W - 305, y: top + i * gap(indicators.length), node: n };
    });
    return { W, H, pos, incidents, indicators };
  }, [g]);

  if (error) return <ErrorState status={error.status} message={error.message} onRetry={load} />;
  if (!g || !layout) return <LoadingBlock label="Menghitung graf korelasi" rows={7} />;
  if (g.nodes.length === 0) {
    return (
      <EmptyState index="GRAF KOSONG" title="Belum ada data untuk digambarkan">
        Graf akan muncul setelah ada laporan dan indikator yang dapat dibandingkan.
      </EmptyState>
    );
  }

  const relatedSet = (id: string) => new Set(g.edges.filter((e) => e.from === id || e.to === id).flatMap((e) => [e.from, e.to]));

  return (
    <div>
      <div className="page-bar">
        <div className="page-lede">
          Insiden di kiri, indikator bersama di kanan. Hanya pasangan berskor ≥ 45 yang digambar;
          simpul tanpa garis adalah laporan yang belum terbukti terkait.
        </div>
        <div className="actions">
          <div className="graph-legend">
            <span className="key"><span className="sq" /> Insiden</span>
            <span className="key"><span className="ci" /> Indikator</span>
            <span className="key"><span className="ln" /> Korelasi</span>
          </div>
        </div>
      </div>

      <div className="graph-hint faint small">Geser graf ke samping untuk melihat indikator di kanan.</div>

      <div className="graph-scroll">
        <div className="card graph-wrap" style={{ minWidth: 760, padding: 0 }}>
          <svg
            viewBox={`0 0 ${layout.W} ${layout.H}`}
            width="100%"
            role="group"
            aria-label="Graf korelasi antara insiden dan indikator bersama"
          >
            <title>Graf korelasi insiden dan indikator</title>
            <text x="185" y="24" textAnchor="middle" style={{ fill: "var(--faint)", fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.1em" }}>
              BERKAS INSIDEN
            </text>
            <text x={layout.W - 305} y="24" textAnchor="middle" style={{ fill: "var(--faint)", fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.1em" }}>
              INDIKATOR BERSAMA
            </text>

            {g.edges.map((e, i: number) => {
              const a = layout.pos[e.from];
              const b = layout.pos[e.to];
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
                  <path
                    key={i}
                    d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`}
                    fill="none"
                    className={"graph-edge" + (hot ? " hot" : "")}
                    opacity={dim ? 0.12 : 0.8}
                    strokeWidth={e.weight >= 60 ? 2 : 1}
                  />
                );
              }
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className={"graph-edge" + (hot ? " hot" : "")}
                  opacity={dim ? 0.12 : 0.85}
                  strokeWidth={e.weight >= 60 ? 2 : 1}
                />
              );
            })}

            {g.nodes.map((n) => {
              const p = layout.pos[n.id];
              if (!p) return null;
              const isIncident = n.kind === "incident";
              const related = hover ? relatedSet(hover).has(n.id) || hover === n.id : true;
              const isolated = isIncident && !g.edges.some((e) => e.from === n.id || e.to === n.id);
              const hot = n.score !== undefined && n.score >= 70;
              return (
                <g
                  key={n.id}
                  className="graph-node"
                  transform={`translate(${p.x},${p.y})`}
                  opacity={related ? 1 : 0.22}
                  style={{ cursor: isIncident ? "pointer" : "default" }}
                  onMouseEnter={() => setHover(n.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => isIncident && goto("incident", n.id)}
                  onKeyDown={(e) => {
                    if (isIncident && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      goto("incident", n.id);
                    }
                  }}
                  tabIndex={isIncident ? 0 : undefined}
                  role={isIncident ? "button" : undefined}
                  aria-label={isIncident ? `Buka ${n.label}` : undefined}
                >
                  {isIncident ? (
                    <>
                      <rect
                        x="-31"
                        y="-20"
                        width="62"
                        height="40"
                        fill="#ffffff"
                        stroke={isolated ? "var(--rule-2)" : hot ? "var(--signal)" : "var(--accent)"}
                        strokeWidth="1.4"
                        strokeDasharray={isolated ? "3 3" : undefined}
                      />
                      <rect x="-27" y="-16" width="54" height="32" fill="none" stroke="var(--rule)" strokeWidth="0.8" />
                      <text
                        textAnchor="middle"
                        dy="5"
                        style={{
                          fontFamily: "var(--sans)",
                          fontSize: 14,
                          fontWeight: 700,
                          fill: isolated ? "var(--faint)" : hot ? "var(--signal)" : "var(--accent)",
                        }}
                      >
                        {Math.round(n.score ?? 0)}
                      </text>
                      <text x="42" dy="-3" style={{ fontSize: 11, fill: "var(--ink)", fontWeight: 600 }}>
                        {n.label.split(" / ")[0].split(" · ")[0]}
                      </text>
                      <text x="42" dy="11" style={{ fontFamily: "var(--mono)", fontSize: 8.5, fill: "var(--faint)" }}>
                        {n.unit}
                      </text>
                      <text x="42" dy="24" style={{ fontFamily: "var(--mono)", fontSize: 8.5, fill: "var(--faint)" }}>
                        {isolated ? "tidak terkait" : n.label.split(" · ")[1] ?? ""}
                      </text>
                    </>
                  ) : (
                    <>
                      <circle r="9" fill="#ffffff" stroke="var(--accent)" strokeWidth="1.4" />
                      <circle r="3" fill="var(--accent)" />
                      <text x="-18" textAnchor="end" dy="4" style={{ fontFamily: "var(--mono)", fontSize: 9, fill: "var(--muted)" }}>
                        {n.label}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="register cols-3" style={{ marginTop: 16 }}>
        <div className="stat">
          <div className="stat-value">{layout.incidents.length}</div>
          <div className="stat-label">Insiden</div>
          <div className="stat-hint">berkas pada graf</div>
        </div>
        <div className="stat">
          <div className="stat-value">{layout.indicators.length}</div>
          <div className="stat-label">Indikator bersama</div>
          <div className="stat-hint">nilai yang menghubungkan laporan</div>
        </div>
        <div className="stat">
          <div className="stat-value">{g.edges.length}</div>
          <div className="stat-label">Tepi korelasi</div>
          <div className="stat-hint">pasangan berskor ≥ 45</div>
        </div>
      </div>

      <div className="disclaimer" style={{ marginTop: 14 }}>
        <Icon name="alert" size={15} />
        <span>
          Korelasi menunjukkan kesamaan indikator, bukan atribusi pelaku. Klik simpul insiden untuk
          membuka berkas kasus; simpul putus-putus berarti tidak ada indikator bersama dengan laporan lain.
        </span>
      </div>
    </div>
  );
}
