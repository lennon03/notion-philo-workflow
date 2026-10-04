export function getRequestToken(request) {
  try {
    return new URL(request.url).searchParams.get("token");
  } catch {
    return null;
  }
}

export function isAuthorized(token) {
  const expected = process.env.TOKEN_PWD;
  if (!expected || !token) return false;
  return token === expected;
}

export function unauthorizedResponse() {
  if (!process.env.TOKEN_PWD) {
    return Response.json({ error: "La variable serveur TOKEN_PWD est absente." }, { status: 500 });
  }
  return Response.json({ error: "Non autorisé." }, { status: 401 });
}
