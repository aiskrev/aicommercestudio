import { expect, test } from "@playwright/test";

/** AI Managed Services operating areas, the planned portal, and the staff-only operations scaffold. */

for (const [path, operations, portal, planned] of [
  ["/bg/uslugi/ai-managed-services", "Какво включва управлението на AI системите", "AI Operations Portal — в разработка", "Планирано"],
  ["/en/services/ai-managed-services", "What operating your AI systems covers", "AI Operations Portal — in development", "Planned"],
] as const) {
  test(`the AI Managed Services page explains operations and shows the portal as planned (${path.slice(1, 3)})`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: operations })).toBeVisible();
    await expect(page.getByTestId("ams-operations").locator("[data-area]")).toHaveCount(8);
    await expect(page.getByRole("heading", { name: portal })).toBeVisible();
    await expect(page.getByTestId("portal-status")).toHaveText(planned);
    await expect(page.getByTestId("portal-modules").locator(":scope > li")).toHaveCount(6);
    // The in-page navigation reaches both new sections.
    await expect(page.locator("a[href='#ams-operations']")).toHaveCount(1);
    await expect(page.locator("a[href='#ams-portal']")).toHaveCount(1);
  });
}

test("the operations scaffold is behind the admin login and its API rejects anonymous requests", async ({ page, request }) => {
  await page.goto("/admin/operations");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Foperations/);
  for (const path of ["/api/ops/organizations", "/api/ops/organizations/00000000-0000-4000-8000-000000000000/agents"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(401);
    expect((await response.json()).code).toBe("unauthorized");
  }
});
