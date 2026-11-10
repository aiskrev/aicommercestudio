import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Analytics } from "@/components/admin/Analytics";
import { adminDictionaries } from "@/i18n/admin";
import type { AnalyticsSummary, AnalyticsVisits } from "@/lib/admin-types";

const fetchMock = vi.fn();
vi.mock("@/lib/admin-api", async (original) => ({
  ...(await original<typeof import("@/lib/admin-api")>()),
  adminFetch: (path: string) => fetchMock(path),
}));

const t = adminDictionaries.bg.analytics;

function summary(overrides: Partial<AnalyticsSummary> = {}): AnalyticsSummary {
  const daily = Array.from({ length: 7 }, (_, i) => ({ date: `2026-11-0${i + 1}`, views: i * 3, visits: i * 2 }));
  return {
    enabled: true,
    retention_days: 180,
    days: 7,
    first_event_at: "2026-10-01T08:00:00Z",
    views: 63,
    visits: 42,
    clicks: 9,
    tool_events: 4,
    daily,
    top_pages: [{ path: "/bg/uslugi/seo-optimizatsiya", views: 12, visits: 8 }],
    top_clicks: [
      { page: "/bg", label: "Поискайте оферта", target: "/bg/kontakti", clicks: 5 },
      { page: "/bg", label: "me", target: "mailto", clicks: 2 },
    ],
    referrers: [{ name: "google.com", count: 7 }],
    devices: [{ name: "mobile", count: 9 }],
    locales: [{ name: "bg", count: 11 }],
    tools: [{ name: "advisor:tool_started", count: 3 }],
    ...overrides,
  };
}

const visits: AnalyticsVisits = {
  day: "2026-11-10",
  visits: [
    {
      id: "a1b2c3",
      started_at: "2026-11-10T09:00:00Z",
      device: "mobile",
      locale: "bg",
      referrer_host: null,
      events: [
        { at: "2026-11-10T09:00:00Z", kind: "view", path: "/bg", label: null, target: null },
        { at: "2026-11-10T09:00:05Z", kind: "click", path: "/bg", label: "Услуги", target: "/bg/uslugi" },
      ],
    },
  ],
};

function serve(data: AnalyticsSummary) {
  fetchMock.mockImplementation(async (path: string) => (path.includes("/visits") ? visits : data));
}

afterEach(() => fetchMock.mockReset());

describe("Analytics dashboard", () => {
  it("shows the totals, the pages, the clicks, the breakdowns and the latest visits", async () => {
    serve(summary());
    render(<Analytics />);
    const stats = await screen.findByTestId("analytics-stats");
    expect(within(stats).getByText("42")).toBeInTheDocument();
    expect(within(stats).getByText("63")).toBeInTheDocument();
    expect(within(stats).getByText("9")).toBeInTheDocument();

    expect(screen.getByText("/bg/uslugi/seo-optimizatsiya")).toBeInTheDocument();
    expect(screen.getByText("Поискайте оферта")).toBeInTheDocument();
    expect(screen.getByText("google.com")).toBeInTheDocument();
    expect(screen.getByText("Телефон")).toBeInTheDocument();
    expect(screen.getByText("advisor:tool_started")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: new RegExp(t.chartLabel) })).toBeInTheDocument();
    expect(await screen.findByText("Посещение #a1b2c3")).toBeInTheDocument();
    expect(screen.getByText("Услуги")).toBeInTheDocument();
    expect(screen.getByText(/Данните се пазят 180 дни/)).toBeInTheDocument();
  });

  it("shows e-mail and telephone links as words, never an address", async () => {
    serve(summary());
    render(<Analytics />);
    expect(await screen.findByText(t.contactLinks.mailto)).toBeInTheDocument();
  });

  it("says that collection is off and keeps the page usable with no data", async () => {
    serve(summary({ enabled: false, views: 0, visits: 0, clicks: 0, tool_events: 0, top_pages: [], top_clicks: [], referrers: [], devices: [], locales: [], tools: [], first_event_at: null }));
    render(<Analytics />);
    expect(await screen.findByText(t.off)).toBeInTheDocument();
    expect(screen.getAllByText(t.empty).length).toBeGreaterThan(0);
  });

  it("asks for the chosen period", async () => {
    serve(summary());
    render(<Analytics />);
    await screen.findByTestId("analytics-stats");
    await userEvent.click(screen.getByRole("button", { name: "Последни 90 дни" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/analytics/summary?days=90"));
    expect(screen.getByRole("button", { name: "Последни 90 дни" })).toHaveAttribute("aria-pressed", "true");
  });
});
