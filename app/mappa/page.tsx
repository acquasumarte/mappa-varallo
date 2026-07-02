"use client";

import { useEffect, useState, useRef } from "react";

// Coordinate centrali delle zone di Varallo Sesia
// (longitudine, latitudine in sistema proiettato su canvas)
const ZONE_COORDS: Record<string, [number, number]> = {
  "Centro storico":       [0.50, 0.48],
  "Sacro Monte":          [0.54, 0.28],
  "Quartiere Stazione":   [0.42, 0.58],
  "Roccapietra":          [0.30, 0.65],
  "Crosa":                [0.60, 0.55],
  "Vocca / Borgosesia (limitrofo)": [0.20, 0.80],
  "Altro":                [0.50, 0.50],
};

// Geocoding approssimativo di indirizzi noti a Varallo
// (estendibile — se non trovato usa la zona)
const ADDR_HINTS: Array<{ keywords: string[]; pos: [number, number] }> = [
  { keywords: ["vittorio", "piazza", "emanuele"], pos: [0.50, 0.47] },
  { keywords: ["sacro", "monte"],                 pos: [0.54, 0.28] },
  { keywords: ["stazione"],                        pos: [0.42, 0.60] },
  { keywords: ["corso", "roma"],                   pos: [0.48, 0.50] },
  { keywords: ["moro"],                            pos: [0.52, 0.46] },
  { keywords: ["chiesa"],                          pos: [0.49, 0.45] },
];

function resolvePosition(zona: string, luogo: string): [number, number] {
  if (luogo) {
    const lower = luogo.toLowerCase();
    for (const hint of ADDR_HINTS) {
      if (hint.keywords.some((k) => lower.includes(k))) {
        return hint.pos;
      }
    }
  }
  const base = ZONE_COORDS[zona] ?? [0.50, 0.50];
  // piccola dispersione casuale (ripetibile per lo stesso contributo)
  const seed = zona.charCodeAt(0) + (luogo?.charCodeAt(0) ?? 0);
  const dx = ((seed * 17) % 40 - 20) / 1000;
  const dy = ((seed * 31) % 40 - 20) / 1000;
  return [base[0] + dx, base[1] + dy];
}

interface Contributo {
  id: string;
  data: string;
  autore: string;
  zona: string;
  luogo: string;
  testo: string;
  tipoFile: string;
  link: string;
  pos: [number, number];
}

// Legge il Google Sheet come CSV pubblico
async function fetchContributi(sheetId: string): Promise<Contributo[]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Foglio1`;
  const res = await fetch(url);
  const text = await res.text();
  const lines = text.trim().split("\n").slice(1); // salta intestazione
  return lines
    .map((line, i) => {
      // parsing CSV base (gestisce virgolette)
      const cols = line.match(/(".*?"|[^,]+)(?=,|$)/g)?.map((c) =>
        c.replace(/^"|"$/g, "").replace(/""/g, '"').trim()
      ) ?? [];
      const [data, autore, zona, luogo, testo, tipoFile, link] = cols;
      if (!autore) return null;
      return {
        id: String(i),
        data: data ?? "",
        autore: autore ?? "",
        zona: zona ?? "",
        luogo: luogo ?? "",
        testo: testo ?? "",
        tipoFile: tipoFile ?? "",
        link: link ?? "",
        pos: resolvePosition(zona ?? "", luogo ?? ""),
      } as Contributo;
    })
    .filter(Boolean) as Contributo[];
}

function getFileId(link: string): string | null {
  const m = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function getThumbnailUrl(link: string, tipoFile: string): string | null {
  if (!link) return null;
  const id = getFileId(link);
  if (!id) return null;
  if (tipoFile.startsWith("image/")) return `https://drive.google.com/thumbnail?id=${id}&sz=w800`;
  if (tipoFile.startsWith("video/")) return `https://drive.google.com/thumbnail?id=${id}&sz=w800`;
  return null;
}

export default function MappaPage() {
  const [contributi, setContributi] = useState<Contributo[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [phase, setPhase] = useState<"map" | "reveal" | "content" | "fade">("map");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetId = process.env.NEXT_PUBLIC_SHEET_ID ?? "";

  useEffect(() => {
    if (!sheetId) return;
    fetchContributi(sheetId).then((data) => {
      setContributi(data.filter((c) => c.autore));
    });
  }, [sheetId]);

  // Ciclo automatico
  useEffect(() => {
    if (contributi.length === 0) return;

    function next() {
      setPhase("map");
      timerRef.current = setTimeout(() => {
        const idx = Math.floor(Math.random() * contributi.length);
        setActive(idx);
        setPhase("reveal");
        timerRef.current = setTimeout(() => {
          setPhase("content");
          timerRef.current = setTimeout(() => {
            setPhase("fade");
            timerRef.current = setTimeout(next, 1500);
          }, 9000);
        }, 800);
      }, 3000);
    }

    next();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [contributi]);

  const current = active !== null ? contributi[active] : null;
  const thumb = current ? getThumbnailUrl(current.link, current.tipoFile) : null;
  const isAudio = current?.tipoFile?.startsWith("audio/");
  const isVideo = current?.tipoFile?.startsWith("video/");
  const fileId = current ? getFileId(current.link) : null;

  return (
    <div style={s.root}>
      {/* Titolo fisso in alto */}
      <div style={s.header}>
        <span style={s.headerTitle}>Varallo Sesia</span>
        <span style={s.headerSub}>voci da una città</span>
      </div>

      {/* Mappa SVG schematica */}
      <div style={s.mapWrap}>
        <svg viewBox="0 0 1000 600" style={s.svg} preserveAspectRatio="xMidYMid meet">
          {/* Reticolo tenue */}
          {[0.2, 0.4, 0.6, 0.8].map((v) => (
            <g key={v}>
              <line x1={v * 1000} y1={0} x2={v * 1000} y2={600} stroke="#1a2a1a" strokeWidth={0.5} />
              <line x1={0} y1={v * 600} x2={1000} y2={v * 600} stroke="#1a2a1a" strokeWidth={0.5} />
            </g>
          ))}

          {/* Fiume Sesia — linea poetica */}
          <path
            d="M 80 560 C 120 500, 180 480, 220 440 C 260 400, 300 380, 340 340 C 380 300, 400 260, 430 220 C 460 180, 500 150, 540 120"
            stroke="#1e3a5f"
            strokeWidth={6}
            fill="none"
            opacity={0.5}
          />

          {/* Label fiume */}
          <text x={130} y={510} fill="#1e3a5f" fontSize={11} opacity={0.6}
            fontFamily="'Georgia', serif" transform="rotate(-32, 130, 510)">
            Sesia
          </text>

          {/* Label zone */}
          {Object.entries(ZONE_COORDS).slice(0, 6).map(([nome, [px, py]]) => (
            <text
              key={nome}
              x={px * 1000}
              y={py * 600 - 18}
              fill="#3a4a3a"
              fontSize={10}
              fontFamily="'Georgia', serif"
              textAnchor="middle"
              opacity={0.5}
            >
              {nome}
            </text>
          ))}

          {/* Punti contributi */}
          {contributi.map((c, i) => {
            const cx = c.pos[0] * 1000;
            const cy = c.pos[1] * 600;
            const isActive = i === active;
            return (
              <g key={c.id}>
                {/* alone pulsante */}
                <circle
                  cx={cx} cy={cy} r={isActive ? 28 : 14}
                  fill="none"
                  stroke={isActive ? "#c8a96e" : "#4a7a4a"}
                  strokeWidth={isActive ? 2 : 1}
                  opacity={isActive ? 0.8 : 0.3}
                  style={{ transition: "all 1s ease" }}
                />
                {/* punto centrale */}
                <circle
                  cx={cx} cy={cy} r={isActive ? 7 : 4}
                  fill={isActive ? "#c8a96e" : "#5a9a5a"}
                  opacity={isActive ? 1 : 0.6}
                  style={{ transition: "all 0.8s ease" }}
                />
              </g>
            );
          })}
        </svg>

        {/* Pannello contenuto — emerge dalla mappa */}
        {current && (
          <div style={{
            ...s.panel,
            opacity: phase === "content" ? 1 : 0,
            transform: phase === "content" ? "translateY(0)" : "translateY(20px)",
          }}>
            {/* Colonna sinistra: info */}
            <div style={s.panelLeft}>
              <p style={s.panelZona}>{current.zona}</p>
              {current.luogo && <p style={s.panelLuogo}>{current.luogo}</p>}
              {current.testo && <p style={s.panelTesto}>"{current.testo}"</p>}
              <p style={s.panelAutore}>— {current.autore}</p>
            </div>

            {/* Colonna destra: media */}
            {thumb && !isAudio && (
              <div style={s.panelRight}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumb} alt="" style={s.thumb} />
                {isVideo && <div style={s.videoLabel}>▶ video</div>}
              </div>
            )}
            {isAudio && fileId && (
              <div style={s.panelRight}>
                <div style={s.audioWrap}>
                  <div style={s.audioIcon}>♪</div>
                  <p style={s.audioLabel}>registrazione audio</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contatore in basso */}
      <div style={s.footer}>
        {contributi.length} voci raccolte
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    width: "100vw", height: "100vh",
    background: "#080f08",
    display: "flex", flexDirection: "column",
    fontFamily: "'Georgia', 'Times New Roman', serif",
    overflow: "hidden",
    color: "#c8d8c0",
  },
  header: {
    padding: "18px 40px 8px",
    display: "flex", alignItems: "baseline", gap: 16,
    borderBottom: "1px solid #1a2a1a",
  },
  headerTitle: {
    fontSize: 22, letterSpacing: 6, textTransform: "uppercase",
    color: "#c8a96e", fontWeight: 400,
  },
  headerSub: {
    fontSize: 13, letterSpacing: 3, color: "#4a6a4a", fontStyle: "italic",
  },
  mapWrap: {
    flex: 1, position: "relative", overflow: "hidden",
  },
  svg: {
    width: "100%", height: "100%",
  },
  panel: {
    position: "absolute",
    bottom: 32, left: "50%",
    transform: "translateX(-50%)",
    width: "70%",
    background: "rgba(8,15,8,0.92)",
    border: "1px solid #2a3a2a",
    borderRadius: 4,
    padding: "28px 36px",
    display: "flex", gap: 32,
    transition: "opacity 1s ease, transform 1s ease",
    backdropFilter: "blur(4px)",
  },
  panelLeft: {
    flex: 1, display: "flex", flexDirection: "column", gap: 10,
  },
  panelZona: {
    margin: 0, fontSize: 11, letterSpacing: 4,
    textTransform: "uppercase", color: "#4a7a4a",
  },
  panelLuogo: {
    margin: 0, fontSize: 13, color: "#6a8a6a", fontStyle: "italic",
  },
  panelTesto: {
    margin: 0, fontSize: 17, lineHeight: 1.6,
    color: "#d8e8d0", fontStyle: "italic",
    borderLeft: "2px solid #2a4a2a", paddingLeft: 16,
  },
  panelAutore: {
    margin: 0, fontSize: 12, color: "#c8a96e", letterSpacing: 2,
  },
  panelRight: {
    width: 220, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  thumb: {
    width: "100%", height: 150,
    objectFit: "cover", borderRadius: 2,
    border: "1px solid #2a3a2a",
  },
  videoLabel: {
    marginTop: 6, fontSize: 11, color: "#4a7a4a",
    letterSpacing: 2, textAlign: "center",
  },
  audioWrap: {
    display: "flex", flexDirection: "column",
    alignItems: "center", gap: 8,
    border: "1px solid #2a3a2a", borderRadius: 2,
    padding: "24px 40px",
  },
  audioIcon: { fontSize: 36, color: "#4a7a4a" },
  audioLabel: { margin: 0, fontSize: 11, color: "#4a6a4a", letterSpacing: 2 },
  footer: {
    padding: "10px 40px",
    fontSize: 11, letterSpacing: 3,
    color: "#2a4a2a", textAlign: "right",
    borderTop: "1px solid #1a2a1a",
  },
};
