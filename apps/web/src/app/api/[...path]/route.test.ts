import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET, HEAD } from "./route";

const ctx = (...path: string[]) => ({ params: Promise.resolve({ path }) }) as never;

afterEach(() => vi.unstubAllGlobals());

describe("API proxy", () => {
  it("asks the API with GET for a HEAD request and returns no body", async () => {
    const upstream = vi.fn(async () => new Response('{"status":"ok"}', { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", upstream);

    const response = await HEAD(new NextRequest("http://localhost/api/health", { method: "HEAD" }), ctx("health"));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect((upstream.mock.calls[0] as unknown as [URL, RequestInit])[1].method).toBe("GET");
  });

  it("still returns the body for GET", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"status":"ok"}', { status: 200 })));

    const response = await GET(new NextRequest("http://localhost/api/health"), ctx("health"));

    expect(await response.text()).toBe('{"status":"ok"}');
  });
});
