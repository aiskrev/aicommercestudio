import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ContactDetails } from "@/components/sections/ContactDetails";
import { getContent } from "@/content";
import { getDictionary } from "@/i18n";
import { alternateLocalePath, localizePath } from "@/i18n/config";
import { routes } from "@/lib/routes";

const CYRILLIC = /[Ѐ-ӿ]/;

describe("contact details", () => {
  it.each([
    ["bg", "Телефон", "Имейл", "Обадете се на Iskrev Consulting Ltd на +359 882 377 753", "Изпратете имейл до Iskrev Consulting Ltd на contact@ai-ecomstudio.site"],
    ["en", "Phone", "Email", "Call Iskrev Consulting Ltd at +359 882 377 753", "Email Iskrev Consulting Ltd at contact@ai-ecomstudio.site"],
  ] as const)("renders labels, links and accessible names (%s)", (locale, phone, email, phoneAria, emailAria) => {
    render(<ContactDetails labels={getDictionary(locale).contactDetails} />);
    const list = screen.getByTestId("contact-details");
    expect(within(list).getByText(phone)).toBeInTheDocument();
    expect(within(list).getByText(email)).toBeInTheDocument();
    const call = within(list).getByRole("link", { name: phoneAria });
    expect(call).toHaveAttribute("href", "tel:+359882377753");
    expect(call).toHaveTextContent("+359 882 377 753");
    const mail = within(list).getByRole("link", { name: emailAria });
    expect(mail).toHaveAttribute("href", "mailto:contact@ai-ecomstudio.site");
    expect(mail).toHaveTextContent("contact@ai-ecomstudio.site");
  });
});

describe("founder content", () => {
  const bg = getContent("bg").founder;
  const en = getContent("en").founder;

  it("uses the approved names, titles and calls to action", () => {
    expect([bg.name, bg.title, bg.home.cta]).toEqual(["Александър Искрев", "Основател и CEO, Iskrev Consulting Ltd", "За основателя"]);
    expect([en.name, en.title, en.home.cta]).toEqual(["Aleksandar Iskrev", "Founder & CEO, Iskrev Consulting Ltd", "Meet the Founder"]);
    expect([bg.profile.primaryCta, bg.profile.secondaryCta]).toEqual(["Разгледайте услугите", "Заявете консултация"]);
    expect([en.profile.primaryCta, en.profile.secondaryCta]).toEqual(["Explore Our Services", "Request a Consultation"]);
    expect(en.profile.closing).toEqual(["Strategy grounded in engineering.", "Architecture designed for operations.", "AI built for real business."]);
    expect(en.contactCta.heading).toBe("Discuss Your Next Initiative");
    expect(bg.contactCta.heading).toBe("Нека обсъдим следващата Ви инициатива");
  });

  it("keeps both languages aligned and free of cross-language leakage", () => {
    expect(en.profile.sections).toHaveLength(bg.profile.sections.length);
    expect(en.home.paragraphs).toHaveLength(bg.home.paragraphs.length);
    expect(JSON.stringify(en)).not.toMatch(CYRILLIC);
    expect(bg.home.paragraphs.join(" ")).toContain("инженерен лидер");
    expect(JSON.stringify(bg)).not.toContain("инженерeн"); // Latin "e" inside a Cyrillic word
  });

  it("makes no inflated or unapproved claims", () => {
    const text = JSON.stringify([bg, en]).toLowerCase();
    for (const phrase of ["visionary", "world-class", "unparalleled", "guru", "disruptive", "award", "certified", "testimonial", "coming soon", "@"]) {
      expect(text, phrase).not.toContain(phrase);
    }
  });

  it("keeps metadata within the site's limits", () => {
    for (const profile of [bg.profile, en.profile]) {
      expect(profile.metaTitle.length).toBeLessThanOrEqual(70);
      expect(profile.metaDescription.length).toBeGreaterThanOrEqual(70);
      expect(profile.metaDescription.length).toBeLessThanOrEqual(175);
    }
    expect(bg.profile.metaTitle).toContain("Александър Искрев");
    expect(en.profile.metaTitle).toContain("Aleksandar Iskrev");
  });
});

describe("founder route", () => {
  it("has localized URLs and the language switch maps between them", () => {
    expect(localizePath("bg", routes.founder)).toBe("/bg/za-nas/osnovatel");
    expect(localizePath("en", routes.founder)).toBe("/en/about/founder");
    const slugs = { services: {}, articles: {}, topics: {} };
    expect(alternateLocalePath("/bg/za-nas/osnovatel", "", "en", slugs)).toBe("/en/about/founder");
    expect(alternateLocalePath("/en/about/founder", "", "bg", slugs)).toBe("/bg/za-nas/osnovatel");
  });
});

describe("central contact source", () => {
  it("a changed central e-mail reaches the rendered contact surface", async () => {
    vi.resetModules();
    vi.doMock("@/lib/company", () => ({
      company: {
        phoneDisplay: "+359 2 000 0000",
        phoneUri: "tel:+35920000000",
        contactEmail: "contact@example.org",
        contactEmailUri: "mailto:contact@example.org",
      },
    }));
    const { ContactDetails: Mocked } = await import("@/components/sections/ContactDetails");
    render(<Mocked labels={getDictionary("en").contactDetails} />);
    expect(screen.getByRole("link", { name: "Email Iskrev Consulting Ltd at contact@example.org" })).toHaveAttribute("href", "mailto:contact@example.org");
    vi.doUnmock("@/lib/company");
  });
});
