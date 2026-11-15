import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import NotFound from "@/app/[locale]/not-found";

const pathname = vi.hoisted(() => ({ value: "/bg/nqma-takava-stranitsa" }));
vi.mock("@/lib/use-public-pathname", () => ({ usePublicPathname: () => pathname.value }));

describe("the localized 404 page", () => {
  it("names the problem in the document title, in both languages (audit FS-09)", () => {
    pathname.value = "/bg/nqma-takava-stranitsa";
    const bg = render(<NotFound />);
    expect(document.title).toBe("Страницата не е намерена | A.I. Commerce Studio");
    expect(bg.getByRole("heading", { level: 1 })).toHaveTextContent("Страницата не е намерена");
    bg.unmount();
    pathname.value = "/en/no-such-page";
    const en = render(<NotFound />);
    expect(document.title).toMatch(/\| A\.I\. Commerce Studio$/);
    expect(document.title).not.toMatch(/^Страницата/);
  });
});
