import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProcessTimeline } from "@/components/sections/ProcessTimeline";
import { Alert, Button, ButtonLink, buttonClass, SectionHeading } from "@/components/ui/primitives";

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

describe("interaction system hooks", () => {
  it("wraps button labels and marks the trailing icon for the shared hover/focus nudge", () => {
    render(
      <>
        <Button icon="arrowRight">Изпрати</Button>
        <ButtonLink href="/bg/kontakti" icon="arrowRight">
          Заяви консултация
        </ButtonLink>
      </>,
    );
    for (const control of [screen.getByRole("button", { name: "Изпрати" }), screen.getByRole("link", { name: "Заяви консултация" })]) {
      expect(control.querySelector(".btn-label")).not.toBeNull();
      expect(control.querySelector("svg")).toHaveClass("btn-icon");
    }
  });

  it("drops the trailing icon while loading", () => {
    render(
      <Button icon="arrowRight" loading loadingLabel="Изпращане…">
        Изпрати
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Изпращане…" });
    expect(button.querySelector(".btn-icon")).toBeNull();
    expect(button.querySelector(".spinner")).not.toBeNull();
  });

  it("reveals section headings on scroll but never the page H1", () => {
    render(
      <>
        <SectionHeading as="h1" title="Услуги" />
        <SectionHeading title="Процес" />
      </>,
    );
    expect(screen.getByRole("heading", { level: 1 }).parentElement).not.toHaveClass("reveal");
    expect(screen.getByRole("heading", { level: 2 }).parentElement).toHaveClass("reveal");
  });
});
