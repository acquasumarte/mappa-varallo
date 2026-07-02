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

export async function GET(
  req: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    const { fileId } = params;
    if (!fileId) return new NextResponse("fileId mancante", { status: 400 });

    const auth = getDriveAuth();
    const { token } = await auth.getAccessToken();

    // Recupera i metadati del file (mimeType)
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType,size`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const meta = await metaRes.json();
    const mimeType = meta.mimeType || "application/octet-stream";

    // Scarica il contenuto del file da Drive
    const range = req.headers.get("range");
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (range) headers["Range"] = range;

    const fileRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers }
    );

    const status = range ? 206 : 200;
    const responseHeaders: Record<string, string> = {
      "Content-Type": mimeType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    };
    if (fileRes.headers.get("content-length"))
      responseHeaders["Content-Length"] = fileRes.headers.get("content-length")!;
    if (fileRes.headers.get("content-range"))
      responseHeaders["Content-Range"] = fileRes.headers.get("content-range")!;

    return new NextResponse(fileRes.body, {
      status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error(err);
    return new NextResponse(err.message || "Errore", { status: 500 });
  }
}
