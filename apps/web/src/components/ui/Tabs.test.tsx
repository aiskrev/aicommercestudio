import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Tabs } from "@/components/ui/Tabs";

function Example() {
  const [value, setValue] = useState<"a" | "b" | "c">("a");
  return (
    <Tabs
      id="demo"
      label="Филтър"
      value={value}
      onChange={setValue}
      items={[
        { value: "a", label: "Чакащи", count: 3 },
        { value: "b", label: "Одобрени" },
        { value: "c", label: "Всички" },
      ]}
    >
      <p>Панел {value}</p>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("exposes the WAI-ARIA tabs structure with one tab stop", () => {
    render(<Example />);
    const list = screen.getByRole("tablist", { name: "Филтър" });
    const tabs = screen.getAllByRole("tab");
    expect(list).toContainElement(tabs[0]);
    expect(tabs.map((t) => t.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    const panel = screen.getByRole("tabpanel");
    expect(tabs[0]).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", tabs[0].id);
    expect(tabs[0]).toHaveTextContent("Чакащи3");
  });

  it("moves and selects with arrow keys, Home and End (wrapping)", async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.tab();
    expect(screen.getByRole("tab", { name: /Чакащи/ })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Одобрени" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Одобрени" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Панел b");
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Всички" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Чакащи/ })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Всички" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Home}");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Панел a");
  });

  it("selects on click and keeps the panel labelled by the selected tab", async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(screen.getByRole("tab", { name: "Всички" }));
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", screen.getByRole("tab", { name: "Всички" }).id);
  });
});
