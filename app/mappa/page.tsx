"use client";

import { useEffect, useState, useRef, useCallback } from "react";

const ZONE_COORDS: Record<string, [number, number]> = {
  "Centro storico":                 [0.50, 0.48],
  "Sacro Monte":                    [0.54, 0.28],
  "Quartiere Stazione":             [0.42, 0.58],
  "Roccapietra":                    [0.30, 0.65],
  "Crosa":                          [0.60, 0.55],
  "Vocca / Borgosesia (limitrofo)": [0.20, 0.80],
  "Altro":                          [0.50, 0.50],
};

const ADDR_HINTS: Array<{ keywords: string[]; pos: [number, number] }> = [
  { keywords: ["vittorio", "emanuele"],  pos: [0.50, 0.47] },
  { keywords: ["sacro", "monte"],        pos: [0.54, 0.28] },
  { keywords: ["stazione"],              pos: [0.42, 0.60] },
  { keywords: ["corso", "roma"],         pos: [0.48, 0.50] },
  { keywords: ["moro"],                  pos: [0.52, 0.46] },
  { keywords: ["umberto"],               pos: [0.50, 0.47] },
  { keywords: ["garibaldi"],             pos: [0.51, 0.49] },
  { keywords: ["piazza"],                pos: [0.50, 0.47] },
  { keywords: ["chiesa"],                pos: [0.49, 0.45] },
];

function jitter(seed: string, range: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return ((h & 0xffff) / 0xffff - 0.5) * range;
}

function resolvePosition(zona: string, luogo: string, autore: string): [number, number] {
  if (luogo) {
    const lower = luogo.toLowerCase();
    for (const hint of ADDR_HINTS) {
      if (hint.keywords.some((k) => lower.includes(k))) {
        const seed = autore + zona;
        return [hint.pos[0] + jitter(seed + "x", 0.025), hint.pos[1] + jitter(seed + "y", 0.025)];
      }
    }
  }
  const zonaKey = Object.keys(ZONE_COORDS).find(
    (k) => k.toLowerCase().trim() === zona.toLowerCase().trim()
  );
  const base: [number, number] = zonaKey ? ZONE_COORDS[zonaKey] : [0.50, 0.50];
  const seed = autore + zona + luogo;
  return [base[0] + jitter(seed + "x", 0.04), base[1] + jitter(seed + "y", 0.04)];
}

interface Contributo {
  id: string; autore: string; zona: string; luogo: string;
  testo: string; tipoFile: string; link: string; pos: [number, number];
}

async function fetchContributi(sheetId: string): Promise<Contributo[]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Foglio1`;
  const res = await fetch(url);
  const text = await res.text();
  return text.trim().split("\n").slice(1).map((line, i) => {
    const cols = line.match(/(".*?"|[^,]+)(?=,|$)/g)?.map((c) =>
      c.replace(/^"|"$/g, "").replace(/""/g, '"').trim()) ?? [];
    const [, autore, zona, luogo, testo, tipoFile, link] = cols;
    if (!autore) return null;
    return { id: String(i), autore: autore ?? "", zona: zona ?? "", luogo: luogo ?? "",
      testo: testo ?? "", tipoFile: tipoFile ?? "", link: link ?? "",
      pos: resolvePosition(zona ?? "", luogo ?? "", autore ?? "") } as Contributo;
  }).filter(Boolean) as Contributo[];
}

function getFileId(link: string): string | null {
  return link?.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? null;
}

// Tutti i media usano iframe Drive preview — il metodo più affidabile per file pubblici
function DriveMedia({ contributo }: { contributo: Contributo }) {
  const fileId = getFileId(contributo.link);
  if (!fileId) return null;
  const tipo = contributo.tipoFile;

  // Per immagini: thumbnail ad alta risoluzione
  if (tipo.startsWith("image/")) {
    return (
      <img
        src={`https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`}
        alt=""
        style={s.mediaImg}
      />
    );
  }

  // Video e audio: iframe preview di Drive con autoplay
  // L'autoplay funziona perché l'utente ha già interagito con la pagina (click iniziale)
  const autoplayUrl = `https://drive.google.com/file/d/${fileId}/preview?autoplay=1&mute=0`;

  if (tipo.startsWith("video/")) {
    return (
      <iframe key={fileId} src={autoplayUrl} style={s.mediaFrame}
        allow="autoplay; fullscreen" allowFullScreen />
    );
  }

  if (tipo.startsWith("audio/")) {
    return (
      <div style={s.audioBox}>
        <div style={s.audioWaveform}>
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} style={{
              ...s.audioBar,
              height: `${20 + Math.sin(i * 1.3) * 16 + Math.cos(i * 0.7) * 10}px`,
              animationDelay: `${i * 0.1}s`,
            }} />
          ))}
        </div>
        <iframe key={fileId} src={autoplayUrl} style={s.audioFrame} allow="autoplay" />
        <p style={s.audioLabel}>registrazione audio</p>
      </div>
    );
  }
  return null;
}

export default function MappaPage() {
  const [started, setStarted] = useState(false);
  const [contributi, setContributi] = useState<Contributo[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [phase, setPhase] = useState<"map" | "reveal" | "content" | "fade">("map");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetId = process.env.NEXT_PUBLIC_SHEET_ID ?? "";

  useEffect(() => {
    if (!sheetId) return;
    fetchContributi(sheetId).then((data) => setContributi(data.filter((c) => c.autore)));
  }, [sheetId]);

  const startCycle = useCallback(() => {
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
          }, 30000);
        }, 800);
      }, 3000);
    }
    next();
  }, [contributi]);

  function handleStart() {
    setStarted(true);
    // Piccolo audio silenzioso per sbloccare l'autoplay nel browser
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    ctx.resume();
  }

  useEffect(() => {
    if (!started || contributi.length === 0) return;
    startCycle();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [started, contributi, startCycle]);

  const current = active !== null ? contributi[active] : null;
  const hasMedia = !!(current?.link && current?.tipoFile);

  // Schermata iniziale — l'operatore clicca una volta per sbloccare audio/video
  if (!started) {
    return (
      <div style={s.startScreen} onClick={handleStart}>
        <div style={s.startBox}>
          <p style={s.startTitle}>VARALLO SESIA</p>
          <p style={s.startSub}>voci da una città</p>
          <p style={s.startCta}>tocca per avviare la proiezione</p>
          <p style={s.startCount}>{contributi.length > 0 ? `${contributi.length} contributi caricati` : "caricamento..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={s.root}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scaleY(1); }
          50% { opacity: 1; transform: scaleY(1.5); }
        }
      `}</style>

      <div style={s.header}>
        <span style={s.headerTitle}>Varallo Sesia</span>
        <span style={s.headerSub}>voci da una città</span>
      </div>

      <div style={s.mapWrap}>
        <svg viewBox="0 0 1000 600" style={s.svg} preserveAspectRatio="xMidYMid meet">
          {[0.2, 0.4, 0.6, 0.8].map((v) => (
            <g key={v}>
              <line x1={v*1000} y1={0} x2={v*1000} y2={600} stroke="#1a2a1a" strokeWidth={0.5}/>
              <line x1={0} y1={v*600} x2={1000} y2={v*600} stroke="#1a2a1a" strokeWidth={0.5}/>
            </g>
          ))}
          <path d="M 80 560 C 120 500, 180 480, 220 440 C 260 400, 300 380, 340 340 C 380 300, 400 260, 430 220 C 460 180, 500 150, 540 120"
            stroke="#1e3a5f" strokeWidth={6} fill="none" opacity={0.5} />
          <text x={130} y={510} fill="#1e3a5f" fontSize={11} opacity={0.6}
            fontFamily="Georgia, serif" transform="rotate(-32, 130, 510)">Sesia</text>
          {Object.entries(ZONE_COORDS).map(([nome, [px, py]]) => (
            <text key={nome} x={px*1000} y={py*600 - 18} fill="#3a4a3a" fontSize={10}
              fontFamily="Georgia, serif" textAnchor="middle" opacity={0.5}>{nome}</text>
          ))}
          {contributi.map((c, i) => {
            const cx = c.pos[0] * 1000;
            const cy = c.pos[1] * 600;
            const isActive = i === active;
            return (
              <g key={c.id}>
                <circle cx={cx} cy={cy} r={isActive ? 32 : 16} fill="none"
                  stroke={isActive ? "#c8a96e" : "#4a7a4a"}
                  strokeWidth={isActive ? 2 : 1} opacity={isActive ? 0.9 : 0.35}
                  style={{ transition: "all 1s ease" }} />
                <circle cx={cx} cy={cy} r={isActive ? 8 : 4}
                  fill={isActive ? "#c8a96e" : "#5a9a5a"} opacity={isActive ? 1 : 0.6}
                  style={{ transition: "all 0.8s ease" }} />
              </g>
            );
          })}
        </svg>

        {current && (
          <div style={{
            ...s.panel,
            opacity: phase === "content" ? 1 : 0,
            transform: phase === "content"
              ? "translateX(-50%) translateY(0)"
              : "translateX(-50%) translateY(24px)",
            flexDirection: hasMedia ? "row" : "column",
          }}>
            <div style={{ ...s.panelLeft, maxWidth: hasMedia ? "50%" : "100%" }}>
              <p style={s.panelZona}>{current.zona}</p>
              {current.luogo && <p style={s.panelLuogo}>{current.luogo}</p>}
              {current.testo && <p style={s.panelTesto}>"{current.testo}"</p>}
              <p style={s.panelAutore}>— {current.autore}</p>
            </div>
            {hasMedia && (
              <div style={s.panelRight}>
                <DriveMedia contributo={current} />
              </div>
            )}
          </div>
        )}
      </div>

      <div style={s.footer}>
        {contributi.length} {contributi.length === 1 ? "voce raccolta" : "voci raccolte"}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: { width: "100vw", height: "100vh", background: "#080f08", display: "flex",
    flexDirection: "column", fontFamily: "Georgia, 'Times New Roman', serif",
    overflow: "hidden", color: "#c8d8c0" },
  startScreen: { width: "100vw", height: "100vh", background: "#080f08", display: "flex",
    alignItems: "center", justifyContent: "center", cursor: "pointer",
    fontFamily: "Georgia, serif" },
  startBox: { textAlign: "center", display: "flex", flexDirection: "column", gap: 16 },
  startTitle: { margin: 0, fontSize: 36, letterSpacing: 10, textTransform: "uppercase",
    color: "#c8a96e", fontWeight: 400 },
  startSub: { margin: 0, fontSize: 16, letterSpacing: 4, color: "#4a6a4a", fontStyle: "italic" },
  startCta: { margin: "24px 0 0", fontSize: 13, letterSpacing: 3, color: "#3a5a3a",
    textTransform: "uppercase" },
  startCount: { margin: 0, fontSize: 11, color: "#2a3a2a", letterSpacing: 2 },
  header: { padding: "18px 40px 8px", display: "flex", alignItems: "baseline", gap: 16,
    borderBottom: "1px solid #1a2a1a" },
  headerTitle: { fontSize: 22, letterSpacing: 6, textTransform: "uppercase",
    color: "#c8a96e", fontWeight: 400 },
  headerSub: { fontSize: 13, letterSpacing: 3, color: "#4a6a4a", fontStyle: "italic" },
  mapWrap: { flex: 1, position: "relative", overflow: "hidden" },
  svg: { width: "100%", height: "100%" },
  panel: { position: "absolute", bottom: 28, left: "50%",
    transform: "translateX(-50%)", width: "72%",
    background: "rgba(6,12,6,0.94)", border: "1px solid #2a3a2a", borderRadius: 3,
    padding: "26px 34px", display: "flex", gap: 30,
    transition: "opacity 1.2s ease, transform 1.2s ease",
    backdropFilter: "blur(6px)", alignItems: "center" },
  panelLeft: { flex: 1, display: "flex", flexDirection: "column", gap: 10 },
  panelZona: { margin: 0, fontSize: 10, letterSpacing: 4, textTransform: "uppercase",
    color: "#4a7a4a" },
  panelLuogo: { margin: 0, fontSize: 13, color: "#6a8a6a", fontStyle: "italic" },
  panelTesto: { margin: 0, fontSize: 18, lineHeight: 1.65, color: "#d8e8d0",
    fontStyle: "italic", borderLeft: "2px solid #2a4a2a", paddingLeft: 16 },
  panelAutore: { margin: 0, fontSize: 12, color: "#c8a96e", letterSpacing: 2 },
  panelRight: { width: 280, flexShrink: 0, display: "flex", alignItems: "center",
    justifyContent: "center" },
  mediaImg: { width: "100%", height: 180, objectFit: "cover", borderRadius: 2,
    border: "1px solid #2a3a2a", display: "block" },
  mediaFrame: { width: "100%", height: 180, border: "1px solid #2a3a2a",
    borderRadius: 2, background: "#000" },
  audioBox: { width: "100%", display: "flex", flexDirection: "column",
    alignItems: "center", gap: 8, border: "1px solid #2a3a2a",
    borderRadius: 2, padding: "14px 20px" },
  audioWaveform: { display: "flex", alignItems: "flex-end", gap: 4, height: 50 },
  audioBar: { width: 6, background: "#4a7a4a", borderRadius: 2,
    animation: "pulse 1.4s ease-in-out infinite" },
  audioFrame: { width: "100%", height: 80, border: "none", background: "transparent" },
  audioLabel: { margin: 0, fontSize: 10, color: "#4a6a4a", letterSpacing: 3,
    textTransform: "uppercase" },
  footer: { padding: "10px 40px", fontSize: 11, letterSpacing: 3, color: "#2a4a2a",
    textAlign: "right", borderTop: "1px solid #1a2a1a" },
};
