import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const { fileName, mimeType, autore } = await req.json();
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID mancante");

    const auth = getDriveAuth();
    const accessTokenRes = await auth.getAccessToken();
    const accessToken = accessTokenRes.token;

    const safeName = `${Date.now()}_${(autore || "").replace(/[^a-z0-9]/gi, "_")}_${fileName}`;

    // Crea una sessione di upload "resumable" direttamente sulle API di Drive
    const initRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": mimeType,
        },
        body: JSON.stringify({
          name: safeName,
          parents: [folderId],
        }),
      }
    );

    if (!initRes.ok) {
      const err = await initRes.text();
      throw new Error(`Errore Drive: ${err}`);
    }

    // Google restituisce l'URL di upload nell'header "Location"
    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) throw new Error("URL di upload non ricevuto da Drive");

    return NextResponse.json({ uploadUrl, safeName });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Errore interno" }, { status: 500 });
  }
}
