import { expect, type Page, test } from "@playwright/test";

const CYRILLIC = /[Ѐ-ӿ]/;

const LOCALES = [
  {
    locale: "bg",
    home: "/bg",
    profile: "/bg/za-nas/osnovatel",
    otherProfile: "/en/about/founder",
    name: "Александър Искрев",
    title: "Основател и CEO, Iskrev Consulting Ltd",
    cta: "За основателя",
    services: { label: "Разгледайте услугите", path: "/bg/uslugi" },
    consult: { label: "Заявете консултация", path: "/bg/kontakti" },
    closing: "AI, създаден за реалния бизнес.",
    contactHeading: "Нека обсъдим следващата Ви инициатива",
    call: "Обадете се на +359 882 377 753",
    phoneLabel: "Телефон",
    emailLabel: "Имейл",
    phoneAria: "Обадете се на Iskrev Consulting Ltd на +359 882 377 753",
    emailAria: "Изпратете имейл до Iskrev Consulting Ltd на contact@ai-ecomstudio.site",
    titleTag: /Александър Искрев — основател и CEO на Iskrev Consulting Ltd/,
    contact: "/bg/kontakti",
  },
  {
    locale: "en",
    home: "/en",
    profile: "/en/about/founder",
    otherProfile: "/bg/za-nas/osnovatel",
    name: "Aleksandar Iskrev",
    title: "Founder & CEO, Iskrev Consulting Ltd",
    cta: "Meet the Founder",
    services: { label: "Explore Our Services", path: "/en/services" },
    consult: { label: "Request a Consultation", path: "/en/contact" },
    closing: "AI built for real business.",
    contactHeading: "Discuss Your Next Initiative",
    call: "Call +359 882 377 753",
    phoneLabel: "Phone",
    emailLabel: "Email",
    phoneAria: "Call Iskrev Consulting Ltd at +359 882 377 753",
    emailAria: "Email Iskrev Consulting Ltd at contact@ai-ecomstudio.site",
    titleTag: /Aleksandar Iskrev — Founder & CEO, Iskrev Consulting Ltd/,
    contact: "/en/contact",
  },
] as const;

async function portraitLoaded(page: Page, alt: RegExp) {
  const image = page.getByRole("img", { name: alt }).first();
  await expect(image).toBeVisible();
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
}

for (const l of LOCALES) {
  test.describe(`founder (${l.locale})`, () => {
    test("homepage introduction links to the profile", async ({ page }) => {
      await page.goto(l.home);
      const section = page.locator("section", { has: page.getByRole("heading", { level: 2, name: l.name }) });
      await expect(section).toContainText(l.title);
      await portraitLoaded(page, new RegExp(l.name));
      await section.getByRole("link", { name: l.cta }).click();
      await expect(page).toHaveURL(new RegExp(`${l.profile}$`));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(l.name);
    });

    test("profile: content, calls to action, contact, metadata and structured data", async ({ page }) => {
      const response = await page.goto(l.profile);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle(l.titleTag);
      await expect(page.getByText(l.title).first()).toBeVisible();
      await expect(page.getByText(l.closing)).toBeVisible();
      await portraitLoaded(page, new RegExp(l.name));

      const canonical = await page.locator("link[rel='canonical']").getAttribute("href");
      expect(canonical).toMatch(new RegExp(`${l.profile}$`));
      const alternates = await page.locator("link[rel='alternate'][hreflang]").evaluateAll((links) =>
        links.map((link) => new URL(link.getAttribute("href") ?? "").pathname),
      );
      expect(alternates).toContain(l.otherProfile);

      const jsonLd = (await page.locator("script[type='application/ld+json']").allTextContents()).map((t) => JSON.parse(t));
      const person = jsonLd.flat().find((item) => item["@type"] === "Person");
      expect(person).toMatchObject({ name: "Aleksandar Iskrev", telephone: "+359882377753", email: "contact@ai-ecomstudio.site" });
      expect(person.worksFor.name).toBe("Iskrev Consulting Ltd");

      const main = page.locator("main");
      const call = main.getByRole("link", { name: l.phoneAria }).first();
      await expect(call).toHaveAttribute("href", "tel:+359882377753");
      await expect(main.getByRole("link", { name: l.phoneAria }).filter({ hasText: l.call })).toHaveCount(1);
      await expect(main.getByRole("link", { name: l.emailAria })).toHaveAttribute("href", "mailto:contact@ai-ecomstudio.site");
      await expect(main.getByRole("heading", { level: 2, name: l.contactHeading })).toBeVisible();
      if (l.locale === "en") expect(await main.innerText()).not.toMatch(CYRILLIC);

      await main.getByRole("link", { name: l.services.label }).click();
      await expect(page).toHaveURL(new RegExp(`${l.services.path}$`));
      await page.goBack();
      await main.getByRole("link", { name: l.consult.label }).first().click();
      await expect(page).toHaveURL(new RegExp(`${l.consult.path}$`));
      await expect(page.locator("form").first()).toBeVisible(); // the consultation form is intact
    });

    test("contact page and footer show the approved contact details", async ({ page }) => {
      await page.goto(l.contact);
      for (const scope of [page.locator("main"), page.locator("footer")]) {
        const details = scope.getByTestId("contact-details");
        await expect(details.getByText(l.phoneLabel, { exact: true })).toBeVisible();
        await expect(details.getByText(l.emailLabel, { exact: true })).toBeVisible();
        await expect(details.getByRole("link", { name: l.phoneAria })).toHaveAttribute("href", "tel:+359882377753");
        await expect(details.getByRole("link", { name: l.emailAria })).toHaveText("contact@ai-ecomstudio.site");
      }
    });
  });
}

test("the founder link is reachable by keyboard", async ({ page }) => {
  await page.goto("/en");
  const link = page.getByRole("link", { name: "Meet the Founder" });
  await link.focus();
  await expect(link).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/en\/about\/founder$/);
});

test("the language switcher moves between the founder profiles", async ({ page }) => {
  await page.goto("/bg/za-nas/osnovatel");
  await page.locator("header").getByRole("link", { name: "Switch to English" }).first().click();
  await expect(page).toHaveURL(/\/en\/about\/founder$/);
});

test("the founder profile fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const path of ["/bg/za-nas/osnovatel", "/en/about/founder", "/bg", "/bg/za-nas"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
  }
});
