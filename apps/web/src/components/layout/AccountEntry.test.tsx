import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountLinks, resetAccountsEnabledCache } from "@/components/layout/AccountEntry";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const links = {
  signIn: { href: "/bg/konto/vhod", label: "Вход" },
  register: { href: "/bg/konto/registratsiya", label: "Създайте акаунт" },
};

function answer(body: unknown, ok = true) {
  const fetchMock = vi.fn(async () => ({ ok, json: async () => body }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("AccountLinks", () => {
  beforeEach(() => resetAccountsEnabledCache());
  afterEach(() => vi.unstubAllGlobals());

  it("renders nothing while customer accounts are switched off", async () => {
    const fetchMock = answer({ enabled: false });
    const { container } = render(<AccountLinks links={links} variant="header" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/account-flag", { cache: "no-store" }));
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the answer is missing or the request fails", async () => {
    answer({}, false);
    const { container } = render(<AccountLinks links={links} variant="sheet" />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows sign-in and sign-up in the header once accounts are on", async () => {
    answer({ enabled: true });
    render(<AccountLinks links={links} variant="header" />);
    expect(await screen.findByRole("link", { name: "Вход" })).toHaveAttribute("href", "/bg/konto/vhod");
    expect(screen.getByRole("link", { name: "Създайте акаунт" })).toHaveAttribute("href", "/bg/konto/registratsiya");
  });

  it("renders list items for the footer and both links in the mobile sheet", async () => {
    answer({ enabled: true });
    const { unmount } = render(
      <ul>
        <AccountLinks links={links} variant="footer" />
      </ul>,
    );
    expect(await screen.findAllByRole("listitem")).toHaveLength(2);
    unmount();
    render(<AccountLinks links={links} variant="sheet" />);
    expect(await screen.findByRole("link", { name: "Създайте акаунт" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Вход" })).toBeInTheDocument();
  });
});
