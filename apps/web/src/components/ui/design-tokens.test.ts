import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/*
 * Design-token guard (docs/DESIGN_SYSTEM.md, "Token discipline"): public UI uses semantic tokens
 * (fg-*, surface-*, line-*, brand*, success/warning/danger, on-*), never raw Tailwind palettes or
 * hard-coded colours. The admin area (components/admin, app/admin) is not covered yet.
 */

const SRC = join(__dirname, "..", "..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith(".tsx") && !path.includes(".test.") ? [path] : [];
  });
}

const PUBLIC = [...files(join(SRC, "components")), ...files(join(SRC, "app"))]
  .map((path) => ({ path, rel: relative(SRC, path).replaceAll("\\", "/") }))
  .filter(({ rel }) => !rel.startsWith("components/admin/") && !rel.startsWith("app/admin/"));

const RAW_PALETTE =
  /(?<![\w-])(?:text|bg|border|ring|divide|outline|decoration|fill|stroke|from|via|to|shadow)-(?:slate|gray|zinc|neutral|stone|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|red|orange|amber|yellow|lime|green|emerald|teal|white|black)(?:-\d{2,3})?(?:\/[\w.[\]]+)?(?![\w-])/g;

// Files that legitimately carry literal colours: the logo drawing (frozen by the owner), the
// generated OG image, and theme-colour metadata.
const HEX_ALLOWED = new Set(["components/layout/Logo.tsx", "app/opengraph-image.tsx", "app/[locale]/layout.tsx"]);

describe("design tokens", () => {
  it("public components and pages use semantic colour utilities only", () => {
    const offenders = PUBLIC.flatMap(({ path, rel }) =>
      [...readFileSync(path, "utf8").matchAll(RAW_PALETTE)].map((m) => `${rel}: ${m[0]}`),
    );
    expect(offenders).toEqual([]);
  });

  it("public components and pages contain no hard-coded hex colours", () => {
    const offenders = PUBLIC.filter(({ rel }) => !HEX_ALLOWED.has(rel)).flatMap(({ path, rel }) =>
      [...readFileSync(path, "utf8").matchAll(/["'`\s(]#[0-9a-fA-F]{3,8}\b/g)].map((m) => `${rel}: ${m[0].trim()}`),
    );
    expect(offenders).toEqual([]);
  });

  it("the component layer in globals.css takes colours from tokens", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "") // comments
      .replace(/@theme\s*\{[\s\S]*?\n\}/, "") // token definitions
      .replace(/@property[^}]*\}/g, ""); // registered properties need literal initial values
    const hex = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
    // Only the frozen logo wordmark gradient may use literals.
    expect(new Set(hex)).toEqual(new Set(["#67e8f9", "#60a5fa", "#a78bfa"]));
  });

  it("text and component tokens meet WCAG 2.2 AA contrast", () => {
    const theme = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const token = (name: string) => {
      const m = theme.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
      if (!m) throw new Error(`token ${name} not found`);
      return m[1];
    };
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [luminance(token(a)), luminance(token(b))].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    // Text pairs (≥ 4.5:1).
    for (const [fg, bg] of [
      ["fg", "surface-page"],
      ["fg-muted", "surface-1"],
      ["fg-subtle", "surface-3"],
      ["on-brand", "brand"],
      ["on-brand", "brand-glow-a"],
      ["on-brand", "brand-glow-b"],
      ["on-danger-fill", "danger-fill"],
      ["on-danger-fill", "danger-fill-hover"],
      ["ink", "surface-light"],
      ["ink-muted", "surface-light"],
      ["brand-ink", "surface-light"],
    ]) {
      expect(contrast(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    // Non-text UI against the page (≥ 3:1).
    for (const [ui, bg] of [
      ["line-strong", "surface-1"],
      ["line-hover", "surface-1"],
      ["danger-fill", "surface-page"],
      ["ink-line", "surface-paper-field"],
    ]) {
      expect(contrast(ui, bg), `${ui} on ${bg}`).toBeGreaterThanOrEqual(3);
    }
  });
});
