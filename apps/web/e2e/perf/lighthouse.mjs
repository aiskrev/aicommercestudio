// Lab performance baseline with Lighthouse (not part of the Playwright test run).
// Runs each route LH_RUNS times per preset and reports the run with the median performance score.
// Usage: scripts/lighthouse.ps1 (runs this inside the e2e container against the production build).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = (process.env.E2E_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const RUNS = Number(process.env.LH_RUNS ?? 3);
const LABEL = process.env.LH_LABEL ?? "baseline";
const ROUTES = (process.env.LH_ROUTES ??
  "/bg,/en,/bg/uslugi,/bg/uslugi/ai-managed-services,/bg/kontakti,/bg/ai-automation-advisor").split(",");
const PRESETS = (process.env.LH_PRESETS ?? "mobile,desktop").split(",");
const OUT = path.join("perf-results", LABEL);
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];

function chromePath() {
  const root = "/ms-playwright";
  for (const dir of fs.readdirSync(root).filter((d) => d.startsWith("chromium-")).sort().reverse()) {
    for (const sub of ["chrome-linux64", "chrome-linux"]) {
      const candidate = path.join(root, dir, sub, "chrome");
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  throw new Error("Chromium not found under /ms-playwright");
}

function runOnce(url, preset, file) {
  const args = [
    url,
    "--output=json",
    `--output-path=${file}`,
    "--quiet",
    `--only-categories=${CATEGORIES.join(",")}`,
    "--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage",
  ];
  if (preset === "desktop") args.push("--preset=desktop");
  execFileSync("lighthouse", args, { stdio: "inherit", env: { ...process.env, CHROME_PATH: chromePath() } });
  const report = JSON.parse(fs.readFileSync(file, "utf8"));
  const audit = (id) => report.audits[id]?.numericValue ?? null;
  const score = (id) => Math.round((report.categories[id]?.score ?? 0) * 100);
  return {
    performance: score("performance"),
    accessibility: score("accessibility"),
    bestPractices: score("best-practices"),
    seo: score("seo"),
    fcpMs: Math.round(audit("first-contentful-paint")),
    lcpMs: Math.round(audit("largest-contentful-paint")),
    tbtMs: Math.round(audit("total-blocking-time")),
    cls: Number((audit("cumulative-layout-shift") ?? 0).toFixed(3)),
    speedIndexMs: Math.round(audit("speed-index")),
    transferKb: Math.round((audit("total-byte-weight") ?? 0) / 1024),
    lighthouseVersion: report.lighthouseVersion,
  };
}

fs.mkdirSync(path.join(OUT, "raw"), { recursive: true });
const results = [];
for (const preset of PRESETS) {
  for (const route of ROUTES) {
    const runs = [];
    for (let i = 1; i <= RUNS; i++) {
      const name = `${preset}${route.replaceAll("/", "_")}-${i}.json`;
      runs.push(runOnce(`${BASE}${route}`, preset, path.join(OUT, "raw", name)));
    }
    const sorted = [...runs].sort((a, b) => a.performance - b.performance);
    const median = sorted[Math.floor(sorted.length / 2)];
    results.push({ route, preset, runs: runs.length, performanceScores: runs.map((r) => r.performance), ...median });
    console.log(`${preset} ${route}: perf ${median.performance}, LCP ${median.lcpMs} ms, TBT ${median.tbtMs} ms, CLS ${median.cls}`);
  }
}

const summary = { label: LABEL, base: BASE, runsPerPage: RUNS, measuredAt: new Date().toISOString(), results };
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
const header = "| Preset | Route | Perf (runs) | A11y | BP | SEO | FCP | LCP | TBT | CLS | Transfer |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |";
const rows = results.map(
  (r) =>
    `| ${r.preset} | \`${r.route}\` | **${r.performance}** (${r.performanceScores.join(", ")}) | ${r.accessibility} | ${r.bestPractices} | ${r.seo} | ${(r.fcpMs / 1000).toFixed(2)} s | ${(r.lcpMs / 1000).toFixed(2)} s | ${r.tbtMs} ms | ${r.cls} | ${r.transferKb} KB |`,
);
fs.writeFileSync(path.join(OUT, "summary.md"), `${header}\n${rows.join("\n")}\n`);
