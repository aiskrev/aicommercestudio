# AI ROI calculator and Automation Opportunity Finder

Two client-side tools (no API, nothing stored or sent):

| Tool | Route (BG ↔ EN) | Logic | UI | Content |
| --- | --- | --- | --- | --- |
| AI ROI calculator | `/bg/instrumenti/roi-kalkulator` ↔ `/en/tools/roi-calculator` | `src/lib/roi.ts` | `components/tools/roi/RoiCalculator.tsx` | `content/{bg,en}/tool-roi.ts` |
| Automation Opportunity Finder | `/bg/instrumenti/avtomatizatsii` ↔ `/en/tools/automation-finder` | `src/lib/finder.ts` | `components/tools/finder/OpportunityFinder.tsx` | `content/{bg,en}/tool-finder.ts` |

Charts: `components/tools/charts/Charts.tsx` (stacked bars, line chart, bar list, value/complexity matrix).
Registry keys `roi` and `finder` (flags `tool_roi`, `tool_finder`, both on).

## Connections

* **Finder → ROI.** "Calculate the effect for this process" opens the calculator with the process
  name as its description. The name travels through `sessionStorage` (`acs:roi:process`), never in a
  URL, and is removed once read. No numbers are passed: the visitor enters them.
* **AI team configurator → ROI.** "Calculate the ROI with these costs" passes the team estimate's
  expected-scenario costs as `?impl=` (one-time total), `?run=` (infrastructure + model usage) and
  `?maint=` (monitoring and maintenance). Only cost fields are accepted from the URL; the calculator
  says they were prefilled and they remain editable. Savings inputs are never prefilled.
* **Finder → AI team.** Opportunities with AI agents link to the configurator; agent suggestions
  reuse the team model (`recommendAgents`, `AGENTS` from `lib/ai-team.ts`).

## ROI calculator

### Policy (resolves P0 issue #2 in PLATFORM_EXPANSION_PLAN.md)

* Computes **only from values the visitor enters**; every field starts empty, including the share of
  released time that becomes savings (an explicit choice, never a default).
* Formulas are shown on the page and in the export; no AI-generated numbers.
* Released time (**capacity**) is shown separately from **realised financial savings**.
* No guarantees: the result says it is indicative, based only on the entered values, and should be
  validated with a pilot. Scenario adjustments are stated with their exact percentages.

### Inputs and bounds

| Field | Unit | Bounds |
| --- | --- | --- |
| Tasks per month `V` | count | 1 – 1 000 000, whole number |
| Average minutes per task `M` | min | 0.1 – 600 |
| Fully loaded hourly cost `R` | EUR/h | 1 – 500 |
| Share of tasks automated `c` | % | 0 – 100 |
| Time reduction per automated task `r` | % | 0 – 100 |
| Human review per automated task `q` | min | 0 – 600 |
| One-time implementation cost `I` | EUR | 0 – 10 000 000 |
| Monthly AI/API/infrastructure | EUR/month | 0 – 1 000 000 |
| Monthly maintenance | EUR/month | 0 – 1 000 000 |
| Horizon `T` | months | 6 / 12 / 24 / 36 (validated 1 – 60) |
| Realisation share `p` | % | 0 / 25 / 50 / 75 / 100 |

Parsing accepts `1 234,5`, `1,234.5` and `1234.5`. A missing, non-numeric, out-of-range or
non-integer value produces a field error and no result; nothing is calculated from partial input.

### Formulas

```
H₀ = V × M / 60                                   current hours per month
C₀ = H₀ × R                                       current monthly process cost
A  = V × c                                        automated tasks
H₁ = (V − A) × M / 60 + A × (M × (1 − r) + q) / 60   future hours
ΔH = H₀ − H₁                                      capacity released (negative = extra time)
value of released time = ΔH × R                   capacity, not cash
S  = ΔH × R × p     if ΔH ≥ 0                     realised monthly savings
S  = ΔH × R         if ΔH < 0                     extra time always costs in full
K  = AI/API/infrastructure + maintenance          monthly solution cost
C₁ = C₀ − S + K                                   estimated future monthly process cost
N  = S − K                                        net monthly benefit
payback = I / N  if N > 0;  0 if I = 0 and N > 0;  "not reached" if N ≤ 0
net(T) = T × N − I                                (12-month net benefit: T = 12)
ROI(T) = (T × S − I − T × K) / (I + T × K) × 100  "not applicable" if I + T × K = 0
```

Division is guarded (payback only for N > 0, ROI only for a positive cost base); every bound
combination is tested to yield finite numbers.

### Scenarios

Applied to the visitor's own inputs (percentages capped at 100):

| Scenario | Coverage | Time reduction | Review time | Monthly costs | Implementation |
| --- | --- | --- | --- | --- | --- |
| Conservative | × 0.75 | × 0.75 | × 1.25 | × 1.20 | × 1.20 |
| Base | your values | | | | |
| Optimistic | × 1.15 | × 1.15 | × 0.85 | × 1.00 | × 1.00 |

### Output and export

Current and future monthly cost, net monthly benefit, payback, 12-month net benefit, ROI over the
horizon; released hours, value of released time, realised savings, running costs and investment; a
"now vs after" stacked bar, the cumulative net benefit per scenario (payback markers on the zero
line, keyboard-readable crosshair) and a scenario table. Export: print, a `.txt` summary and a share
link `?r=` with the numbers only (never the description).

## Automation Opportunity Finder

Up to five processes (name + department), each rated on nine criteria with described levels 0–4.

| Criterion | Group | Direction |
| --- | --- | --- |
| Repetitiveness, rule clarity, data availability | fit | higher = better |
| Exception rate | fit | higher = harder |
| Frequency, business impact | value | higher = better |
| Integration complexity, compliance risk, human oversight needs | effort | higher = harder |

```
favourability f = level / 4            (higher = better)
                = (4 − level) / 4      (higher = harder)
fit    = mean f(fit criteria) × 100
value  = mean f(value criteria) × 100
effort = mean (1 − f)(effort criteria) × 100
suitability = 0.45 × fit + 0.30 × value + 0.25 × (100 − effort), rounded
```

**Categories** (first match): *not ready* — fit < 40 or data availability 0; *quick win* —
suitability ≥ 60, value ≥ 50, effort ≤ 50; *high-value complex project* — value ≥ 50; otherwise
*later*. **Ranking:** suitability, then value, then entry order.

**Pattern** (first match): not ready → *sort out the process first*; rule clarity ≥ 3, exceptions ≤ 1,
data ≥ 3 → *classic workflow automation* (no AI); data ≤ 2 and rule clarity ≥ 2 → *AI classification
and extraction*; integration ≥ 3, frequency ≥ 3, rule clarity ≥ 2 → *agentic workflow*; otherwise *AI
assistant with a human decision*. **Human approval** when compliance risk ≥ 3 or oversight needs ≥ 3
(not for processes that are not ready).

**Blockers:** data ≤ 1, rule clarity ≤ 1, exceptions ≥ 3, compliance ≥ 3, integration ≥ 3,
frequency ≤ 1 — each mapped to a next step; category steps follow (max four steps).

**Agents:** none for classic automation or not-ready processes; otherwise the extraction agent for
the department (support → Customer Support, sales/marketing → Lead Qualification, else Document
Processing), the department's first task agent from the team model, the Workflow Coordinator for
agentic workflows and the Approval Supervisor when approval is required.

**Output:** ranking bar chart, value × complexity matrix (quadrants at 50 = the category thresholds),
and per process the score with its three parts and their contributions, category, pattern, agents,
blockers, next steps and a per-criterion breakdown. Export: print and a `.txt` summary. There is no
share link because process names are free text.

## Charts and accessibility

* Series colours `--color-viz-1…3` (`#3987e5`, `#d95926`, `#199e70`) in fixed order — the dataviz
  reference dark steps, validated on the chart surface `#0d1724` with `validate_palette.js --mode dark
  --pairs all` (all checks pass; worst CVD ΔE 9.4, normal-vision ΔE 20.9, ≥ 3:1 contrast). The site
  is dark-only, so no light variant is needed.
* Legends for multi-series charts plus direct end labels; values in text tokens; hairline grid;
  hover/focus tooltips repeat values that are also in the stat tiles or the scenario table.
* The line chart draws at its container's real width, so axis text stays 11 px on phones.
* Forms: native inputs and radio groups, field hints and errors via `aria-describedby`, errors shown
  after leaving a field (or on request), live result region.

## Tests

`src/lib/roi.test.ts`, `src/lib/finder.test.ts` (formulas with hand-checked examples, bounds, zero
division, scenarios, categories, patterns, ranking ties, texts in both languages),
`src/components/tools/roi-finder.test.tsx` (no presets, live result, validation, prefill, hand-off,
export, Bulgarian), `e2e/tests/roi-finder.spec.ts` and `e2e/tests/mobile.spec.ts`.
