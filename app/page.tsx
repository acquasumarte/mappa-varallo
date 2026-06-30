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
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      const res = await fetch("/api/submit", { method: "POST", body: data });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Errore sconosciuto");
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
          <button style={styles.button} onClick={() => setStatus("idle")}>
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
          <option value="" disabled>
            Seleziona...
          </option>
          {ZONE.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
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
          Su smartphone questo aprirà direttamente fotocamera/microfono. Video max consigliato 30 secondi.
        </p>

        <button style={styles.button} type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Invio in corso..." : "Invia contributo"}
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
  input: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #ddd",
    fontSize: 15,
    fontFamily: "inherit",
  },
  hint: { fontSize: 12, color: "#999", margin: "4px 0 0" },
  button: {
    marginTop: 20,
    padding: "12px 16px",
    borderRadius: 8,
    border: "none",
    background: "#a0522d",
    color: "white",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
  error: { color: "#c0392b", fontSize: 13, marginTop: 8 },
};
