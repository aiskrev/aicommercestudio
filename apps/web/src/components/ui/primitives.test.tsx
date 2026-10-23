import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProcessTimeline } from "@/components/sections/ProcessTimeline";
import { Alert, Button, buttonClass } from "@/components/ui/primitives";

describe("Button", () => {
  it("shows a busy, disabled state while loading", () => {
    render(
      <Button loading loadingLabel="Изпращане…">
        Изпрати
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Изпращане…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("is a non-submitting button by default", () => {
    render(<Button>Действие</Button>);
    expect(screen.getByRole("button", { name: "Действие" })).toHaveAttribute("type", "button");
  });

  it("composes design-system classes for variants and sizes", () => {
    expect(buttonClass("secondary", "lg")).toBe("btn btn-lg btn-secondary");
    expect(buttonClass()).toBe("btn btn-md btn-primary");
  });
});

describe("Alert", () => {
  it("renders the title, message and requested role", () => {
    render(
      <Alert tone="error" role="alert" title="Грешка">
        Опитайте отново.
      </Alert>,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Грешка");
    expect(alert).toHaveTextContent("Опитайте отново.");
    expect(alert.className).toContain("alert-error");
  });
});

describe("ProcessTimeline", () => {
  it("renders an ordered list of numbered steps", () => {
    render(
      <ProcessTimeline
        steps={[
          { title: "Разговор", description: "Уточняваме целите." },
          { title: "Анализ", description: "Преглеждаме системите." },
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("01Разговор");
    expect(screen.getByRole("heading", { name: "Анализ" })).toBeInTheDocument();
  });
});
