import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

/**
 * API Backend Proxy
 * 
 * This route handler proxies requests from the Next.js frontend to the FastAPI backend.
 * It handles:
 * - Session cookie → Bearer token conversion
 * - Client IP address forwarding (for geo lookup)
 * - User-Agent forwarding (for device detection)
 * - CSRF protection for cross-site mutations
 * - Auth response token storage in httpOnly cookies
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const AUTH_RESPONSE_PATHS = new Set([
  "auth/login",
  "auth/register",
  "auth/email-verification/confirm"
]);

function apiBaseUrl() {
  return (
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
}

function resolvePublicOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedHost) {
    return `${forwardedProto || "https"}://${forwardedHost}`;
  }
  return request.nextUrl.origin;
}

function isCrossSiteMutation(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) return false;

  const fetchSite = request.headers.get("sec-fetch-site");
  // Same-origin fetches from the app domain are safe (common behind reverse proxies).
  if (fetchSite === "same-origin" || fetchSite === "same-site" || fetchSite === "none") {
    return false;
  }
  if (fetchSite === "cross-site") return true;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  // Behind Traefik/Dokploy, nextUrl.origin may be http://… while the browser sends https://…
  return origin !== resolvePublicOrigin(request);
}

function resolveClientIp(request: NextRequest) {
  // Priority order matches backend's _IP_HEADERS check
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) {
    const first = cfIp.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const vercelIp = request.headers.get("x-vercel-forwarded-for");
  if (vercelIp) {
    const first = vercelIp.split(",")[0]?.trim();
    if (first) return first;
  }

  return undefined;
}

function logProxyHeaders(path: string, clientIp: string | undefined, userAgent: string | null) {
  // Logging disabled - client info is forwarded to backend for login emails
}

async function forward(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  if (isCrossSiteMutation(request)) {
    return NextResponse.json({ detail: "Cross-site request rejected." }, { status: 403 });
  }

  const { path } = await context.params;
  const backendPath = path.join("/");
  const target = new URL(`${apiBaseUrl()}/${backendPath}`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const accept = request.headers.get("accept");
  if (contentType) headers.set("Content-Type", contentType);
  if (accept) headers.set("Accept", accept);

  // Forward the original browser User-Agent, not the Next.js server's
  const userAgent = request.headers.get("user-agent");
  if (userAgent) headers.set("User-Agent", userAgent);

  // Resolve and forward client IP address
  const clientIp = resolveClientIp(request);
  if (clientIp) {
    // Forward all IP headers that the backend checks
    headers.set("X-Forwarded-For", clientIp);
    headers.set("X-Real-IP", clientIp);
    
    // Include Vercel-specific header if present
    const vercelIp = request.headers.get("x-vercel-forwarded-for");
    if (vercelIp) {
      headers.set("X-Vercel-Forwarded-For", vercelIp);
    }
    
    // Include Cloudflare header if present
    const cfIp = request.headers.get("cf-connecting-ip");
    if (cfIp) {
      headers.set("CF-Connecting-IP", cfIp);
    }
  }

  // Log headers for debugging (development only)
  logProxyHeaders(backendPath, clientIp, userAgent);

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: SAFE_METHODS.has(request.method) ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      signal: request.signal
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backend unreachable";
    console.error("[api-proxy] backend unreachable", {
      origin: target.origin,
      path: backendPath,
      error: message
    });
    return NextResponse.json(
      {
        error: {
          code: "backend_unreachable",
          message: "The service is temporarily unavailable. Please try again shortly."
        }
      },
      { status: 502 }
    );
  }

  const responseHeaders = new Headers();
  for (const name of [
    "content-type",
    "cache-control",
    "content-disposition",
    "connection",
    "x-accel-buffering",
    "x-ai-ui-stream",
    "x-vercel-ai-ui-message-stream"
  ]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  if (
    AUTH_RESPONSE_PATHS.has(backendPath) &&
    upstream.ok &&
    upstream.headers.get("content-type")?.includes("application/json")
  ) {
    const payload = (await upstream.json()) as Record<string, unknown>;
    const accessToken = typeof payload.access_token === "string" ? payload.access_token : null;
    const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : undefined;
    delete payload.access_token;

    const response = NextResponse.json(payload, {
      status: upstream.status,
      headers: responseHeaders
    });
    if (accessToken) {
      response.cookies.set(SESSION_COOKIE_NAME, accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: expiresIn
      });
    }
    return response;
  }

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders
  });
  if (backendPath === "auth/logout") {
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0
    });
  } else if (backendPath === "auth/me" && upstream.status === 401) {
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0
    });
  }
  return response;
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const OPTIONS = forward;
