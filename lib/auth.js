export function getRequestToken(request) {
  try {
    return new URL(request.url).searchParams.get("token");
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
