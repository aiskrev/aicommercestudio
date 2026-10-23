import { expect, test } from "@playwright/test";

test("there are no broken internal links", async ({ page, request, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const toVisit = new Set<string>(["/"]);

  // Every URL from the sitemap, re-based onto the tested origin.
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const match of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) toVisit.add(new URL(match[1]).pathname);

  const visited = new Set<string>();
  const broken: string[] = [];
  while (toVisit.size > 0) {
    const [path] = toVisit;
    toVisit.delete(path);
    if (visited.has(path)) continue;
    visited.add(path);

    const response = await page.goto(path);
    if (!response || response.status() !== 200) {
      broken.push(`${path} -> ${response?.status()}`);
      continue;
    }
    const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).href));
    for (const href of hrefs) {
      const url = new URL(href);
      if (url.origin !== origin || url.pathname.startsWith("/admin")) continue;
      if (!visited.has(url.pathname)) toVisit.add(url.pathname);
    }
  }

  expect(visited.size).toBeGreaterThan(20);
  expect(broken).toEqual([]);
});
