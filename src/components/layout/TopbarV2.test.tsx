import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TopbarV2 } from "./TopbarV2";

const baseProps = {
  seasonLabel: "Season 2030/31",
  seasonDate: "Wed, 14 May 2030",
  reputationLabel: "Continental",
  reputationStars: 4,
  managerName: "Alex Morgan",
  managerRole: "Head Coach",
  unreadCount: 5,
  onSearch: vi.fn(),
  onInbox: vi.fn(),
  onHelp: vi.fn(),
  onNotifications: vi.fn(),
  onLogoClick: vi.fn(),
};

describe("TopbarV2", () => {
  it("renders template header surface", () => {
    const { container } = render(<TopbarV2 {...baseProps} />);
    expect(container.firstElementChild).toHaveClass("h-20", "border-app-border", "bg-app-bg");
  });

  it("renders season + date + reputation labels", () => {
    render(<TopbarV2 {...baseProps} />);
    expect(screen.getByText("Season 2030/31")).toBeInTheDocument();
    expect(screen.getByText("Wed, 14 May 2030")).toBeInTheDocument();
    expect(screen.getByText("Continental")).toBeInTheDocument();
  });

  it("renders manager name + role", () => {
    render(<TopbarV2 {...baseProps} />);
    expect(screen.getByText("Alex Morgan")).toBeInTheDocument();
    expect(screen.getByText("Head Coach")).toBeInTheDocument();
  });

  it("invokes onSearch when typing", () => {
    const onSearch = vi.fn();
    render(<TopbarV2 {...baseProps} onSearch={onSearch} />);
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: "messi" } });
    expect(onSearch).toHaveBeenLastCalledWith("messi");
  });

  it("shows unread badge when unreadCount > 0", () => {
    render(<TopbarV2 {...baseProps} unreadCount={5} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("hides badge when unreadCount is 0", () => {
    render(<TopbarV2 {...baseProps} unreadCount={0} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("invokes notifications/inbox/help handlers", () => {
    const onNotifications = vi.fn();
    const onInbox = vi.fn();
    const onHelp = vi.fn();
    render(
      <TopbarV2
        {...baseProps}
        onNotifications={onNotifications}
        onInbox={onInbox}
        onHelp={onHelp}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    fireEvent.click(screen.getByRole("button", { name: /inbox/i }));
    fireEvent.click(screen.getByRole("button", { name: /help/i }));
    expect(onNotifications).toHaveBeenCalled();
    expect(onInbox).toHaveBeenCalled();
    expect(onHelp).toHaveBeenCalled();
  });
});
