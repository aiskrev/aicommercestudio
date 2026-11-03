import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { COOKIE_NOTICE_COOKIE, CookieNotice } from "@/components/layout/CookieNotice";
import { getContent } from "@/content";
import { bg } from "@/i18n/dictionaries/bg";
import { en } from "@/i18n/dictionaries/en";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const clearCookie = () => {
  document.cookie = `${COOKIE_NOTICE_COOKIE}=; Path=/; Max-Age=0`;
};

afterEach(clearCookie);

describe("cookie notice", () => {
  it("is a labelled region with the text, a link to the cookie information and one action", () => {
    render(<CookieNotice labels={bg.cookieNotice} href="/bg/biskvitki" />);
    const region = screen.getByRole("region", { name: bg.cookieNotice.label });
    expect(region).toHaveTextContent(bg.cookieNotice.text);
    expect(screen.getByRole("link", { name: bg.cookieNotice.more })).toHaveAttribute("href", "/bg/biskvitki");
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("closes, remembers the choice in its own cookie and stays closed", () => {
    const { unmount } = render(<CookieNotice labels={en.cookieNotice} href="/en/cookies" />);
    fireEvent.click(screen.getByRole("button", { name: en.cookieNotice.accept }));
    expect(screen.queryByTestId("cookie-notice")).toBeNull();
    expect(document.cookie).toContain(`${COOKIE_NOTICE_COOKIE}=1`);
    unmount();
    render(<CookieNotice labels={en.cookieNotice} href="/en/cookies" />);
    expect(screen.queryByTestId("cookie-notice")).toBeNull();
  });

  it("names only cookies that the cookie information lists, in both languages", () => {
    for (const locale of ["bg", "en"] as const) {
      expect(JSON.stringify(getContent(locale).legal.cookiePolicy)).toContain(COOKIE_NOTICE_COOKIE);
    }
    expect(JSON.stringify(en.cookieNotice)).not.toMatch(/[Ѐ-ӿ]/);
  });
});
