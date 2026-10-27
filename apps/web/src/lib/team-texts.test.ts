import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { teamTextsSnapshot } from "@/lib/team-texts";

const FILE = resolve(__dirname, "team-texts.json");

describe("AI team texts for the PDF plan", () => {
  it("snapshot equals the current content (regenerate with UPDATE_TEAM_TEXTS=1)", () => {
    const current = teamTextsSnapshot();
    if (process.env.UPDATE_TEAM_TEXTS === "1") writeFileSync(FILE, `${JSON.stringify(current, null, 1)}\n`, "utf-8");
    // Parsed comparison: independent of line endings in the checkout.
    expect(JSON.parse(readFileSync(FILE, "utf-8"))).toEqual(current);
  });
});
