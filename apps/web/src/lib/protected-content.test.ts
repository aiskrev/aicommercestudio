import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Protected content (CLAUDE.md → "Protected content"): the approved founder portrait and the
 * public contact surfaces. These tests fail if a later change removes or replaces them, so an
 * intentional change has to update this file on the owner's explicit request.
 */

const SRC = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(SRC, path), "utf-8");

const PORTRAIT = "assets/founder/aleksandar-iskrev.webp";
/** SHA-256 of the approved photo (1216 × 1293 WebP, 128 332 bytes), supplied by the owner on 2026-10-28. */
const PORTRAIT_SHA256 = "0f4dba690befdb9e8f92fd368ee904182b2ffb5b3555800612a49b14c55b297a";

describe("approved founder portrait", () => {
  it("is the exact approved file", () => {
    const path = resolve(SRC, PORTRAIT);
    expect(existsSync(path)).toBe(true);
    const bytes = readFileSync(path);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(PORTRAIT_SHA256);
    expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
  });

  it("is the image the portrait component renders", () => {
    expect(read("components/sections/Founder.tsx")).toContain(`from "@/${PORTRAIT}"`);
  });

  it.each([
    ["homepage", "app/[locale]/page.tsx"],
    ["about page", "app/[locale]/za-nas/page.tsx"],
    ["founder profile", "app/[locale]/za-nas/osnovatel/page.tsx"],
  ])("is shown on the %s", (_, file) => {
    expect(read(file)).toContain("<FounderPortrait");
  });
});

describe("public contact surfaces", () => {
  it.each([
    ["contact page", "app/[locale]/kontakti/page.tsx"],
    ["footer", "components/layout/Footer.tsx"],
    ["founder profile", "app/[locale]/za-nas/osnovatel/page.tsx"],
  ])("the %s shows the central contact details", (_, file) => {
    expect(read(file)).toContain("<ContactDetails");
  });

  it("the contact details component reads only the central configuration", () => {
    const text = read("components/sections/ContactDetails.tsx");
    expect(text).toContain('from "@/lib/company"');
    expect(text).toContain("company.phoneUri");
    expect(text).toContain("company.contactEmailUri");
  });
});
