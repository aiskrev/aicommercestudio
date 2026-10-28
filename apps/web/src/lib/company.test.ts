import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { company } from "@/lib/company";
import { founderJsonLd, organizationJsonLd } from "@/lib/seo";

const SRC = resolve(__dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("company contact configuration", () => {
  it("holds the approved phone and e-mail with exact link targets", () => {
    expect(company.phoneDisplay).toBe("+359 882 377 753");
    expect(company.phoneUri).toBe("tel:+359882377753");
    expect(company.phoneE164).toBe("+359882377753");
    expect(company.contactEmail).toBe("contact@ai-ecomstudio.site");
    expect(company.contactEmailUri).toBe("mailto:contact@ai-ecomstudio.site");
    expect(company.legalName).toBe("Iskrev Consulting Ltd");
  });

  it("records that the planned domain and mailbox are not verified", () => {
    expect(company.plannedDomain).toBe("ai-ecomstudio.site");
    expect(company.emailDeliveryVerified).toBe(false);
    expect(company.publicWebsiteLaunched).toBe(false);
  });

  it("keeps the phone, the e-mail and the domain in one source file", () => {
    const files = sourceFiles(SRC).filter((file) => !file.endsWith(join("lib", "company.ts")));
    for (const file of files) {
      const text = readFileSync(file, "utf-8");
      const where = relative(SRC, file);
      expect(text, where).not.toContain("ai-ecomstudio.site");
      expect(text, where).not.toMatch(/\+359[\s\d]{6,}/);
      expect(text, where).not.toMatch(/(?:info|hello|sales|support|office)@/);
    }
  });
});

describe("structured data", () => {
  it("names the legal entity, the founder and the approved contact on the Organization", () => {
    const org = organizationJsonLd("en");
    expect(org).toMatchObject({
      legalName: "Iskrev Consulting Ltd",
      email: "contact@ai-ecomstudio.site",
      telephone: "+359882377753",
      founder: { "@id": expect.stringMatching(/#founder$/) },
    });
    expect(org).not.toHaveProperty("address");
    expect(org).not.toHaveProperty("sameAs");
  });

  it("describes the founder as a Person working for Iskrev Consulting Ltd", () => {
    const person = founderJsonLd(
      { name: "Александър Искрев", latinName: "Aleksandar Iskrev", jobTitle: "Основател и CEO", image: "/img.webp", path: "/bg/za-nas/osnovatel", knowsAbout: ["DevOps"] },
      "bg",
    );
    expect(person).toMatchObject({
      "@type": "Person",
      name: "Aleksandar Iskrev",
      alternateName: "Александър Искрев",
      worksFor: { "@type": "Organization", name: "Iskrev Consulting Ltd" },
      telephone: "+359882377753",
      email: "contact@ai-ecomstudio.site",
    });
    expect(person.url).toMatch(/\/bg\/za-nas\/osnovatel$/);
    expect(person).not.toHaveProperty("sameAs");
    const en = founderJsonLd({ name: "Aleksandar Iskrev", latinName: "Aleksandar Iskrev", jobTitle: "Founder & CEO", image: "/i.webp", path: "/en/about/founder", knowsAbout: [] }, "en");
    expect(en).not.toHaveProperty("alternateName");
  });
});
