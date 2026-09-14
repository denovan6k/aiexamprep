function serverApiBaseUrl() {
  return (
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
}

export async function serverApiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const response = await fetch(`${serverApiBaseUrl()}${path}`, {
    ...options,
    headers,
    cache: "no-store"
  });

  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "detail" in body && typeof body.detail === "string"
        ? body.detail
        : response.statusText || "Request failed";
    throw new Error(message);
  }

  return body as T;
}
