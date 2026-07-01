import { NextResponse } from "next/server";
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

export async function GET() {
  try {
    const auth = getDriveAuth();
    const { token } = await auth.getAccessToken();
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!token) throw new Error("Impossibile ottenere access token");
    if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID mancante");
    // Restituiamo token e folderId al client (il token dura ~1 ora ed è accettabile
    // per questo progetto pubblico)
    return NextResponse.json({ token, folderId });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
