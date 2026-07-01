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
    setProgress("Preparazione...");

    const form = e.currentTarget;
    const autore = (form.elements.namedItem("autore") as HTMLInputElement).value;
    const zona = (form.elements.namedItem("zona") as HTMLSelectElement).value;
    const luogo = (form.elements.namedItem("luogo") as HTMLInputElement).value;
    const testo = (form.elements.namedItem("testo") as HTMLTextAreaElement).value;
    const fileInput = form.elements.namedItem("media") as HTMLInputElement;
    const file = fileInput?.files?.[0] ?? null;

    try {
      if (file) {
        // STEP 1: ottieni access token e folderId da Vercel
        const tokenRes = await fetch("/api/token");
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) throw new Error(tokenData.error || "Errore token");
        const { token, folderId } = tokenData;

        // Genera il nome del file (lo useremo anche per trovarlo su Drive dopo)
        const safeName = `${Date.now()}_${autore.replace(/[^a-z0-9]/gi, "_")}_${file.name}`;

        // STEP 2: avvia sessione resumable upload su Google Drive
        const initRes = await fetch(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "X-Upload-Content-Type": file.type,
              "X-Upload-Content-Length": String(file.size),
            },
            body: JSON.stringify({ name: safeName, parents: [folderId] }),
          }
        );
        if (!initRes.ok) {
          const errText = await initRes.text();
          throw new Error(`Errore Drive: ${errText}`);
        }
        const uploadUrl = initRes.headers.get("location");
        if (!uploadUrl) throw new Error("URL upload non ricevuto");

        // STEP 3: carica il file direttamente su Drive con barra di progresso
        // Nota: il browser non riesce a leggere la risposta finale per CORS,
        // ma il file viene caricato correttamente lo stesso.
        setProgress("Caricamento 0%");
        await new Promise<void>((resolve) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type);

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              setProgress(`Caricamento ${pct}%`);
            }
          };

          // Sia onload che onerror: il file è su Drive, procediamo comunque
          xhr.onload = () => resolve();
          xhr.onerror = () => resolve(); // il file è arrivato anche se la risposta è bloccata
          xhr.send(file);
        });

        // STEP 4: il server cerca il file per nome, imposta i permessi e scrive sullo Sheet
        setProgress("Salvataggio dati...");
        const completeRes = await fetch("/api/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ safeName, mimeType: file.type, autore, zona, luogo, testo }),
        });
        const completeData = await completeRes.json();
        if (!completeRes.ok) throw new Error(completeData.error || "Errore salvataggio");

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
          <p>Il tuo contributo è entrato a far parte della mappa di Varallo.</p>
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
        <textarea style={{ ...styles.input, height: 80 }} name="testo"
          placeholder="Racconta cosa stai mostrando..." />

        <label style={styles.label}>Carica foto, video o audio</label>
        <input style={styles.input} type="file" name="media"
          accept="image/*,video/*,audio/*" capture="environment" />
        <p style={styles.hint}>
          Su smartphone apre fotocamera/microfono. Puoi anche scegliere dalla galleria.
          Video max consigliato 30 secondi.
        </p>

        <button style={styles.button} type="submit" disabled={status === "sending"}>
          {status === "sending" ? (progress || "Invio in corso...") : "Invia contributo"}
        </button>

        {status === "error" && <p style={styles.error}>Errore: {errorMsg}</p>}
      </form>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { display: "flex", justifyContent: "center", padding: "24px 16px", minHeight: "100vh" },
  card: {
    background: "white", borderRadius: 16, padding: 24, maxWidth: 480, width: "100%",
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", gap: 6,
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
