import { expect, test } from "@playwright/test";

/** The test stack runs with the flag off: nothing about accounts may be reachable or discoverable. */
test.describe("customer accounts while the flag is off", () => {
  for (const path of ["/bg/konto", "/bg/konto/registratsiya", "/en/account/sign-in", "/en/account/sign-up"]) {
    test(`${path} is not found`, async ({ request }) => {
      expect((await request.get(path)).status()).toBe(404);
    });
  }

  test("the API refuses every account route", async ({ request }) => {
    const response = await request.post("/api/accounts/register", {
      data: { email: "a@example.com", password: "Correct-Horse-2026", privacy_acknowledged: true },
    });
    expect(response.status()).toBe(404);
  });

  test("robots keeps the area out and the sitemap does not list it", async ({ request }) => {
    expect(await (await request.get("/robots.txt")).text()).toContain("/bg/konto");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).not.toContain("/konto");
    expect(sitemap).not.toContain("/account");
  });
});
