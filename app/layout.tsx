export const metadata = {
  title: "Mappa di Varallo Sesia",
  description: "Raccolta contenuti per la mappa partecipativa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f4f1ec" }}>
        {children}
      </body>
    </html>
  );
}
