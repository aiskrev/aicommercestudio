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

/**
 * The logo mark: the "orbital A" artwork the owner supplied on 2026-11-12 (it replaced the earlier mark at the
 * owner's explicit request), cropped without the outer glow. Header mark, browser-tab icon and iOS icon.
 */
const LOGO_FILES: [string, string][] = [
  ["assets/brand/logo-mark.webp", "a10022bfd0e2e8759b326686239979f4a20becdaaf64e6d5e81be0bc8f56f94e"],
  ["app/icon.png", "4cb660acc8f916a124c08fe2c77228d43980b8762b49c4d0183bde4b602254ae"],
  ["app/apple-icon.png", "7cd263b9bee38c1e8468d25b078ff93a6734e3cf4426f4c17db2470fdac98216"],
];

describe("approved logo", () => {
  it.each(LOGO_FILES)("%s is the exact approved file", (file, sha256) => {
    const path = resolve(SRC, file);
    expect(existsSync(path)).toBe(true);
    expect(createHash("sha256").update(readFileSync(path)).digest("hex")).toBe(sha256);
  });

  it("is the mark the logo component renders", () => {
    expect(read("components/layout/Logo.tsx")).toContain('from "@/assets/brand/logo-mark.webp"');
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
