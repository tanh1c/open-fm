import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tabs } from "./Tabs";

describe("Tabs", () => {
  const items = [
    { id: "squad", label: "Squad" },
    { id: "tactics", label: "Tactics" },
    { id: "fixtures", label: "Fixtures" },
  ];

  it("renders every tab label", () => {
    render(<Tabs items={items} activeId="squad" onChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Squad" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tactics" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Fixtures" })).toBeInTheDocument();
  });

  it("marks the active tab with aria-selected", () => {
    render(<Tabs items={items} activeId="tactics" onChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Tactics" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Squad" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("calls onChange with the tab id when clicked", () => {
    const onChange = vi.fn();
    render(<Tabs items={items} activeId="squad" onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Fixtures" }));
    expect(onChange).toHaveBeenCalledWith("fixtures");
  });
});
