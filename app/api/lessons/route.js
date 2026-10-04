import { getRequestToken, isAuthorized, unauthorizedResponse } from "../../../lib/auth";
import { lessons } from "../../../lib/notion";

export const runtime = "nodejs";

export async function GET(request) {
  if (!isAuthorized(getRequestToken(request))) return unauthorizedResponse();
  try {
    return Response.json({ lessons: await lessons() });
  } catch (error) {
    return Response.json({ error: error.message || "Impossible de lire les leçons Notion." }, { status: 500 });
  }
}
