import { TOKEN_COOKIE } from "../../../lib/auth";

export const runtime = "nodejs";

const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function cookie(value, maxAge) {
  return [
    `${TOKEN_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
  ].join("; ");
}

// Saves the Notion token in an HttpOnly cookie: page scripts cannot read it and
// it never appears in URLs, history or request logs.
export async function POST(request) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token || token.length > 512 || /[\s;]/.test(token)) {
    return Response.json({ error: "Token Notion invalide." }, { status: 400 });
  }
  return new Response(null, { status: 204, headers: { "Set-Cookie": cookie(token, MAX_AGE) } });
}

export async function DELETE() {
  return new Response(null, { status: 204, headers: { "Set-Cookie": cookie("", 0) } });
}
