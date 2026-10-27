import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CaseStudyLayout, DiagramFrame, EditorialSplit, ResultList, SpecList } from "@/components/ui/patterns";
import { Badge, Container, Section, SectionHeading } from "@/components/ui/primitives";

describe("EditorialSplit", () => {
  it("renders the heading column and the content column with overflow-safe tracks", () => {
    const { container } = render(
      <EditorialSplit sticky aside={<h2>Защо автоматизация</h2>}>
        <p>Съдържание</p>
      </EditorialSplit>,
    );
    expect(screen.getByRole("heading", { name: "Защо автоматизация" })).toBeInTheDocument();
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.className).toContain("minmax(0,0.8fr)");
    expect(grid.firstElementChild?.className).toContain("lg:sticky");
  });
});

describe("DiagramFrame", () => {
  it("is a figure named by its title, with the caption as figcaption", () => {
    render(
      <DiagramFrame title="Concept: operations" titleId="ops-title" caption="Illustrative, not live data." testId="frame">
        <ol>
          <li>Monitor</li>
        </ol>
      </DiagramFrame>,
    );
    const figure = screen.getByRole("figure", { name: "Concept: operations" });
    expect(figure).toHaveAttribute("data-testid", "frame");
    expect(within(figure).getByText("Illustrative, not live data.").tagName).toBe("FIGCAPTION");
  });
});

describe("SpecList", () => {
  it("renders label/value pairs as a description list", () => {
    render(<SpecList items={[{ label: "Услуги", value: "AI автоматизация" }]} />);
    const term = screen.getByText("Услуги");
    expect(term.tagName).toBe("DT");
    expect(term.nextElementSibling).toHaveTextContent("AI автоматизация");
  });
});

describe("CaseStudyLayout", () => {
  it("numbers chapters and labels each section by its heading", () => {
    render(
      <CaseStudyLayout
        facts={[{ label: "Services", value: "Integrations" }]}
        chapters={[
          { id: "c1", title: "The challenge", children: <p>Text</p> },
          { id: "c2", title: "The solution", children: <p>Text</p> },
        ]}
      />,
    );
    expect(screen.getByRole("region", { name: "The solution" })).toHaveTextContent("02");
    expect(screen.getByRole("complementary")).toHaveTextContent("Integrations");
  });

  it("keeps the evidence next to every measured result", () => {
    render(<ResultList items={[{ metric: "Manual steps", value: "−40%", evidence: "Source: CRM export · measured 1 Mar 2026" }]} />);
    expect(screen.getByRole("listitem")).toHaveTextContent("Source: CRM export");
  });
});

describe("primitive variants", () => {
  it("maps badge tones to classes and keeps the legacy accent flag", () => {
    render(
      <>
        <Badge tone="success" dot>
          Активно
        </Badge>
        <Badge accent>Ново</Badge>
        <Badge>Неутрално</Badge>
      </>,
    );
    expect(screen.getByText("Активно").className).toBe("badge badge-success badge-dot");
    expect(screen.getByText("Ново").className).toBe("badge badge-accent");
    expect(screen.getByText("Неутрално").className).toBe("badge");
  });

  it("places a section heading action beside the text", () => {
    render(<SectionHeading id="s" title="Услуги" action={<button type="button">Всички услуги</button>} />);
    expect(screen.getByRole("heading", { level: 2, name: "Услуги" })).toHaveClass("t-h2");
    expect(screen.getByRole("button", { name: "Всички услуги" })).toBeInTheDocument();
  });

  it("uses the smaller heading scale for sub-sections", () => {
    render(<SectionHeading title="Свързани статии" size="sm" />);
    expect(screen.getByRole("heading", { name: "Свързани статии" })).toHaveClass("t-h3-lg");
  });

  it("applies container sizes and section tones from tokens", () => {
    const { container } = render(
      <>
        <Container size="reading">a</Container>
        <Section tone="deep" density="compact">
          b
        </Section>
      </>,
    );
    expect(container.querySelector(".max-w-reading")).toHaveTextContent("a");
    expect(container.querySelector("section")?.className).toBe("py-section-compact surface-deep");
  });
});
