import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSheetsAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("Credenziali Service Account mancanti");
  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getDriveAuth() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken)
    throw new Error("Credenziali OAuth Drive mancanti");
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

export async function POST(req: NextRequest) {
  try {
    const { safeName, mimeType, autore, zona, luogo, testo } = await req.json();
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) throw new Error("GOOGLE_SHEET_ID mancante");

    const drive = google.drive({ version: "v3", auth: getDriveAuth() });
    const sheets = google.sheets({ version: "v4", auth: getSheetsAuth() });

    // Cerca il file su Drive per nome (il browser non riesce a leggere il fileId per CORS)
    const search = await drive.files.list({
      q: `name = '${safeName}' and trashed = false`,
      fields: "files(id, webViewLink)",
      pageSize: 1,
    });

    const found = search.data.files?.[0];
    if (!found?.id) throw new Error("File non ancora trovato su Drive, riprova tra qualche secondo");

    // Rende il file pubblico (visibile a chiunque abbia il link)
    await drive.permissions.create({
      fileId: found.id,
      requestBody: { role: "reader", type: "anyone" },
    });

    const fileLink = found.webViewLink || "";

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Foglio1!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" }),
          autore, zona, luogo, testo, mimeType, fileLink,
        ]],
      },
    });

    return NextResponse.json({ ok: true, fileLink });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Errore interno" }, { status: 500 });
  }
}
