import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Users, Settings as SettingsIcon } from "lucide-react";
import { Sidebar, type SidebarItem } from "./Sidebar";

describe("Sidebar", () => {
  const items: SidebarItem[] = [
    { id: "squad", label: "Squad", icon: <Users data-testid="users-icon" /> },
    { id: "settings", label: "Settings", icon: <SettingsIcon data-testid="settings-icon" /> },
  ];

  it("renders an icon button per item with accessible label", () => {
    render(<Sidebar items={items} activeId="squad" onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Squad" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });

  it("invokes onSelect with the id when clicked", () => {
    const onSelect = vi.fn();
    render(<Sidebar items={items} activeId="squad" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(onSelect).toHaveBeenCalledWith("settings");
  });

  it("does not invoke onSelect for disabled items", () => {
    const onSelect = vi.fn();
    const disabledItems: SidebarItem[] = [
      ...items,
      { id: "locked", label: "Locked", icon: <span />, disabled: true },
    ];
    render(<Sidebar items={disabledItems} activeId="squad" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Locked" }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
