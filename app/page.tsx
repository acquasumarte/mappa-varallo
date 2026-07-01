"use client";

import { useState } from "react";

const ZONE = [
  "Centro storico",
  "Sacro Monte",
  "Quartiere Stazione",
  "Roccapietra",
  "Crosa",
  "Vocca / Borgosesia (limitrofo)",
  "Altro",
];

export default function Page() {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [progress, setProgress] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");
    setProgress("Invio in corso...");

    const form = e.currentTarget;
    const autore = (form.elements.namedItem("autore") as HTMLInputElement).value;
    const zona = (form.elements.namedItem("zona") as HTMLSelectElement).value;
    const luogo = (form.elements.namedItem("luogo") as HTMLInputElement).value;
    const testo = (form.elements.namedItem("testo") as HTMLTextAreaElement).value;
    const fileInput = form.elements.namedItem("media") as HTMLInputElement;
    const file = fileInput?.files?.[0] ?? null;

    try {
      if (file) {
        // STEP 1: chiedi a Vercel un URL di upload diretto su Drive
        setProgress("Preparazione caricamento...");
        const prepRes = await fetch("/api/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, mimeType: file.type, autore }),
        });
        const prepData = await prepRes.json();
        if (!prepRes.ok) throw new Error(prepData.error || "Errore preparazione upload");

        const { uploadUrl } = prepData;

        // STEP 2: carica il file DIRETTAMENTE su Google Drive (bypassa Vercel)
        setProgress(`Caricamento file (${Math.round(file.size / 1024 / 1024 * 10) / 10} MB)...`);

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type);

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              setProgress(`Caricamento: ${pct}%`);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Errore upload Drive: ${xhr.status}`));
            }
          };
          xhr.onerror = () => reject(new Error("Errore di rete durante il caricamento"));
          xhr.send(file);
        });

        // STEP 3: estrai il fileId dalla risposta di Drive e completa su Vercel
        setProgress("Salvataggio dati...");

        // Recupera il fileId: Drive lo restituisce nel body JSON dopo l'upload
        // Usiamo /api/complete che lo ricava dall'uploadUrl (che contiene l'upload_id)
        // Facciamo una chiamata GET sull'uploadUrl per ottenere il fileId
        const checkRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type, "Content-Range": `bytes */${file.size}` },
        });
        // A upload completato, Drive risponde 200/201 con il file JSON
        let fileId = "";
        if (checkRes.status === 200 || checkRes.status === 201) {
          const fileData = await checkRes.json();
          fileId = fileData.id || "";
        }

        if (!fileId) throw new Error("Impossibile ottenere l'ID del file caricato");

        const completeRes = await fetch("/api/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId, mimeType: file.type, autore, zona, luogo, testo }),
        });
        const completeData = await completeRes.json();
        if (!completeRes.ok) throw new Error(completeData.error || "Errore salvataggio dati");

      } else {
        // Nessun file: invia solo il testo
        const res = await fetch("/api/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ autore, zona, luogo, testo }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Errore invio");
      }

      setStatus("ok");
      form.reset();
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message);
    }
  }

  if (status === "ok") {
    return (
      <main style={styles.main}>
        <div style={styles.card}>
          <h1 style={styles.title}>Grazie! 🎉</h1>
          <p>Il tuo contributo è stato caricato ed entrerà a far parte della mappa di Varallo.</p>
          <button style={styles.button} onClick={() => { setStatus("idle"); setProgress(""); }}>
            Invia un altro contributo
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      <form style={styles.card} onSubmit={handleSubmit}>
        <h1 style={styles.title}>Mappa di Varallo Sesia</h1>
        <p style={styles.subtitle}>
          Racconta un pezzo della città: una foto, un breve video (max 30s), un audio o un testo.
        </p>

        <label style={styles.label}>Il tuo nome (o iniziali)</label>
        <input style={styles.input} name="autore" required placeholder="es. Maria B." />

        <label style={styles.label}>Zona della città</label>
        <select style={styles.input} name="zona" required defaultValue="">
          <option value="" disabled>Seleziona...</option>
          {ZONE.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>

        <label style={styles.label}>Indirizzo o punto di riferimento (facoltativo)</label>
        <input style={styles.input} name="luogo" placeholder="es. Piazza Vittorio Emanuele II" />

        <label style={styles.label}>Breve testo / didascalia</label>
        <textarea style={{ ...styles.input, height: 80 }} name="testo" placeholder="Racconta cosa stai mostrando..." />

        <label style={styles.label}>Carica foto, video o audio</label>
        <input
          style={styles.input}
          type="file"
          name="media"
          accept="image/*,video/*,audio/*"
          capture="environment"
        />
        <p style={styles.hint}>
          Su smartphone apre direttamente fotocamera/microfono. Puoi anche scegliere un file dalla galleria. Video max consigliato 30 secondi.
        </p>

        <button style={styles.button} type="submit" disabled={status === "sending"}>
          {status === "sending" ? progress || "Invio in corso..." : "Invia contributo"}
        </button>

        {status === "error" && <p style={styles.error}>Errore: {errorMsg}</p>}
      </form>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { display: "flex", justifyContent: "center", padding: "24px 16px", minHeight: "100vh" },
  card: {
    background: "white",
    borderRadius: 16,
    padding: 24,
    maxWidth: 480,
    width: "100%",
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  title: { margin: "0 0 4px", fontSize: 24, color: "#3a2e26" },
  subtitle: { margin: "0 0 16px", color: "#6b5d52", fontSize: 14 },
  label: { fontSize: 13, fontWeight: 600, marginTop: 12, color: "#3a2e26" },
  input: { padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 15, fontFamily: "inherit" },
  hint: { fontSize: 12, color: "#999", margin: "4px 0 0" },
  button: {
    marginTop: 20, padding: "12px 16px", borderRadius: 8, border: "none",
    background: "#a0522d", color: "white", fontSize: 16, fontWeight: 600, cursor: "pointer",
  },
  error: { color: "#c0392b", fontSize: 13, marginTop: 8 },
};
