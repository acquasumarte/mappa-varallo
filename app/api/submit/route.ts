import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { Readable } from "stream";

export const runtime = "nodejs";

function getSheetsAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  // Le chiavi private nelle env var di Vercel vanno spesso salvate con \n letterali:
  // questa riga li converte in newline reali.
  const key = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!email || !key) {
    throw new Error("Credenziali Service Account mancanti nelle variabili d'ambiente");
  }

  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getDriveAuth() {
  // I Service Account non hanno quota di archiviazione su Drive personali, quindi per
  // caricare i file usiamo OAuth a nome del tuo vero account Google (quota tua).
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Credenziali OAuth Drive mancanti nelle variabili d'ambiente");
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const autore = (formData.get("autore") as string) || "";
    const zona = (formData.get("zona") as string) || "";
    const luogo = (formData.get("luogo") as string) || "";
    const testo = (formData.get("testo") as string) || "";
    const file = formData.get("media") as File | null;

    const drive = google.drive({ version: "v3", auth: getDriveAuth() });
    const sheets = google.sheets({ version: "v4", auth: getSheetsAuth() });

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!folderId || !sheetId) {
      throw new Error("ID cartella Drive o foglio Sheet mancanti nelle variabili d'ambiente");
    }

    let fileLink = "";
    let fileType = "";

    if (file && file.size > 0) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const stream = Readable.from(buffer);

      const safeName = `${Date.now()}_${autore.replace(/[^a-z0-9]/gi, "_")}_${file.name}`;

      const uploadRes = await drive.files.create({
        requestBody: {
          name: safeName,
          parents: [folderId],
        },
        media: {
          mimeType: file.type || "application/octet-stream",
          body: stream,
        },
        fields: "id, webViewLink",
      });

      // Rende il file visualizzabile a chiunque abbia il link (utile per proiettare la mappa)
      await drive.permissions.create({
        fileId: uploadRes.data.id!,
        requestBody: { role: "reader", type: "anyone" },
      });

      fileLink = uploadRes.data.webViewLink || "";
      fileType = file.type || "";
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Foglio1!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" }),
            autore,
            zona,
            luogo,
            testo,
            fileType,
            fileLink,
          ],
        ],
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Errore interno" }, { status: 500 });
  }
}
