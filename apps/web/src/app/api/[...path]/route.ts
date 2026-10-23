import type { NextRequest } from "next/server";

/**
 * Same-origin proxy to the FastAPI backend. The browser only ever talks to the web origin, so
 * the admin session cookie stays first-party (HttpOnly, SameSite) and no CORS is needed.
 * The target is read at runtime (API_INTERNAL_URL), so one image works in every environment.
 */
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

function apiBaseUrl(): string {
  return (process.env.API_INTERNAL_URL || "http://localhost:8000").replace(/\/$/, "");
}

function json(status: number, detail: string): Response {
  return Response.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
}

async function proxy(request: NextRequest, ctx: RouteContext<"/api/[...path]">): Promise<Response> {
  const { path } = await ctx.params;
  if (path.some((segment) => segment === "." || segment === ".." || segment.includes("\\"))) {
    return json(400, "Невалиден адрес.");
  }

  const target = new URL(`${apiBaseUrl()}/api/${path.map(encodeURIComponent).join("/")}`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key)) headers.set(key, value);
  });
  headers.set("x-forwarded-host", request.headers.get("host") ?? "");
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));

  let body: ArrayBuffer | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) return json(413, "Заявката е твърде голяма.");
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return json(502, "Услугата временно не е достъпна. Моля, опитайте отново.");
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key) && key !== "set-cookie" && key !== "content-encoding") {
      responseHeaders.set(key, value);
    }
  });
  for (const cookie of upstream.headers.getSetCookie()) responseHeaders.append("set-cookie", cookie);

  return new Response(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export { proxy as DELETE, proxy as GET, proxy as PATCH, proxy as POST, proxy as PUT };
