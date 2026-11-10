import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HomeLink } from "@/components/layout/HomeLink";

let pathname = "/bg";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("HomeLink", () => {
  const scrollTo = vi.fn();

  beforeEach(() => {
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    window.matchMedia = ((query: string) => ({ matches: false, media: query })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => scrollTo.mockClear());

  it("scrolls to the top instead of navigating when the home page is already open", () => {
    pathname = "/bg";
    render(<HomeLink href="/bg">Logo</HomeLink>);
    // fireEvent returns false when the click's default action (navigation) was cancelled.
    expect(fireEvent.click(screen.getByRole("link"))).toBe(false);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("works the same way in English", () => {
    pathname = "/en";
    render(<HomeLink href="/en">Logo</HomeLink>);
    expect(fireEvent.click(screen.getByRole("link"))).toBe(false);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it("leaves the click alone on any other page, so the link navigates to the home page", () => {
    pathname = "/bg/kontakti";
    render(<HomeLink href="/bg">Logo</HomeLink>);
    expect(fireEvent.click(screen.getByRole("link"))).toBe(true);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("does not interfere with modified clicks (open in a new tab)", () => {
    pathname = "/bg";
    render(<HomeLink href="/bg">Logo</HomeLink>);
    expect(fireEvent.click(screen.getByRole("link"), { ctrlKey: true })).toBe(true);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
