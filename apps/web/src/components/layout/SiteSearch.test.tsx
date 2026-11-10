import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetSearchIndexCache, SiteSearch } from "@/components/layout/SiteSearch";
import { bg } from "@/i18n/dictionaries/bg";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const entries = [
  { type: "service", url: "/bg/uslugi/seo-optimizatsiya", title: "SEO оптимизация", description: "Видимост в търсачките", text: "" },
  { type: "service", url: "/bg/uslugi/poddrazhka", title: "Поддръжка на онлайн магазини", description: "Месечна грижа", text: "" },
  { type: "article", url: "/bg/statii/poddrazhka-woo", title: "Поддръжка на WooCommerce", description: "Статия", text: "" },
];

function serve(ok = true) {
  const fetchMock = vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => ({ entries }) }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("SiteSearch", () => {
  beforeEach(() => {
    resetSearchIndexCache();
    push.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("loads the index only when it is opened, and in the page's language", async () => {
    const fetchMock = serve();
    render(<SiteSearch locale="bg" labels={bg.search} />);
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: bg.search.open }));
    expect(screen.getByRole("dialog", { name: bg.search.title })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/search-index?locale=bg"));
    expect(screen.getByRole("combobox")).toHaveFocus();
  });

  it("shows results as you type with their kind, and opens the chosen one with the keyboard", async () => {
    serve();
    render(<SiteSearch locale="bg" labels={bg.search} />);
    await userEvent.click(screen.getByRole("button", { name: bg.search.open }));
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "поддръжка");
    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Резултати: 2");
    expect(options[1]).toHaveTextContent(bg.search.types.article);

    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[1].id);
    await userEvent.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/bg/statii/poddrazhka-woo");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says so when nothing matches", async () => {
    serve();
    render(<SiteSearch locale="bg" labels={bg.search} />);
    await userEvent.click(screen.getByRole("button", { name: bg.search.open }));
    await userEvent.type(screen.getByRole("combobox"), "несъществуващо");
    expect(await screen.findByText(/Няма резултати за „несъществуващо“/)).toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("closes with Escape and gives the focus back to the button", async () => {
    serve();
    render(<SiteSearch locale="bg" labels={bg.search} />);
    const button = screen.getByRole("button", { name: bg.search.open });
    await userEvent.click(button);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("opens with the slash key but not while typing in a field", async () => {
    serve();
    render(
      <>
        <input aria-label="other" />
        <SiteSearch locale="bg" labels={bg.search} />
      </>,
    );
    await userEvent.type(screen.getByLabelText("other"), "/");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => {
      fireEvent.keyDown(document.body, { key: "/" });
    });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("tells the visitor when the index cannot be loaded", async () => {
    serve(false);
    render(<SiteSearch locale="bg" labels={bg.search} />);
    await userEvent.click(screen.getByRole("button", { name: bg.search.open }));
    expect(await screen.findByText(bg.search.error)).toBeInTheDocument();
  });
});
