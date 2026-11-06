export const TOKEN_COOKIE = "notion_token";

function readCookie(request, name) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        return null;
      }
    }
  }
  return null;
}

// The token comes from the HttpOnly cookie. `?token=` is still accepted so
// older embed links keep working; the client moves it into the cookie.
export function getRequestToken(request) {
  try {
    return new URL(request.url).searchParams.get("token") || readCookie(request, TOKEN_COOKIE) || null;
  } catch {
    return null;
  }
}

export function requestPageId(request) {
  try {
    return new URL(request.url).searchParams.get("id")?.trim() || null;
  } catch {
    return null;
  }
}
