import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DataRights } from "@/components/account/DataRights";
import { accountTexts } from "@/i18n/account";

const d = accountTexts.bg.data;
const fetchMock = vi.fn();

function reply(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url.endsWith("/data/requests") && init?.method === "POST") {
      return reply({ reference: "D-AB12CD", kind: "deletion", status: "open", created_at: "2026-11-10T10:00:00Z", created: true }, 202);
    }
    if (url.endsWith("/data/requests")) return reply([]);
    return reply({});
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("data rights", () => {
  it("says a deletion request was received, never that data was deleted", async () => {
    render(<DataRights locale="bg" />);
    expect(await screen.findByText(d.deletionNote)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: d.send }));
    expect(await screen.findByText(new RegExp(`${d.received} D-AB12CD`))).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST") as [string, RequestInit];
    expect(JSON.parse(post[1].body as string)).toEqual({ kind: "deletion", message: null });
    expect(document.body.textContent).not.toMatch(/изтрит(и|а|о)\b/);
  });

  it("offers the four request kinds and an export", async () => {
    render(<DataRights locale="en" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getAllByRole("option")).toHaveLength(4);
    expect(screen.getByRole("button", { name: accountTexts.en.data.export })).toBeInTheDocument();
  });
});
