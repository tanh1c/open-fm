import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Home as HomeIcon, Users } from "lucide-react";
import { SidebarV2, type SidebarV2Item } from "./SidebarV2";

const items: SidebarV2Item[] = [
  { id: "dashboard", label: "Dashboard", icon: <HomeIcon /> },
  { id: "squad", label: "Squad", icon: <Users /> },
];

describe("SidebarV2", () => {
  it("renders template sidebar surface and brand header", () => {
    const { container } = render(<SidebarV2 items={items} activeId="dashboard" onSelect={vi.fn()} />);
    expect(container.firstElementChild).toHaveClass("w-64", "border-app-border", "bg-[#151b23]");
    expect(screen.getByTestId("sidebar-brand")).toHaveClass("h-16", "px-6");
    expect(screen.getByText("OpenManager")).toBeInTheDocument();
  });

  it("renders active nav dot and template nav classes", () => {
    render(<SidebarV2 items={items} activeId="dashboard" onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Dashboard" })).toHaveClass(
      "rounded-lg",
      "text-sm",
      "font-medium",
    );
    expect(screen.getByTestId("sidebar-active-dot")).toBeInTheDocument();
  });

  it("renders items with their labels", () => {
    render(<SidebarV2 items={items} activeId="dashboard" onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Squad" })).toBeInTheDocument();
  });

  it("invokes onSelect with the id", () => {
    const onSelect = vi.fn();
    render(<SidebarV2 items={items} activeId="dashboard" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Squad" }));
    expect(onSelect).toHaveBeenCalledWith("squad");
  });

  it("renders pinned slot when provided", () => {
    render(
      <SidebarV2
        items={items}
        activeId="dashboard"
        onSelect={vi.fn()}
        pinned={<div data-testid="next-match">Pinned</div>}
      />,
    );
    expect(screen.getByTestId("next-match")).toBeInTheDocument();
  });

  it("renders footer slot when provided", () => {
    render(
      <SidebarV2
        items={items}
        activeId="dashboard"
        onSelect={vi.fn()}
        footer={<button>Custom Footer</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Custom Footer" })).toBeInTheDocument();
  });

  it("renders badge when item.badge > 0", () => {
    const itemsWithBadge: SidebarV2Item[] = [
      ...items,
      { id: "inbox", label: "Inbox", icon: <HomeIcon />, badge: 7 },
    ];
    render(
      <SidebarV2 items={itemsWithBadge} activeId="dashboard" onSelect={vi.fn()} />,
    );
    expect(screen.getByText("7")).toBeInTheDocument();
  });
});
