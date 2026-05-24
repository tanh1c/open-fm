import {
  Briefcase,
  ClipboardList,
  Crosshair,
  DollarSign,
  Dumbbell,
  FileText,
  Info,
  Landmark,
  Newspaper,
  ScanSearch,
  Smile,
  Stethoscope,
  TableProperties,
  TrendingUp,
  Trophy,
} from "lucide-react";
import type { JSX, ReactNode } from "react";

import type { MessageAction, MessageData } from "../../store/gameStore";

export interface NavigateActionType {
  NavigateTo: { route: string };
}

export interface ChooseOptionActionType {
  ChooseOption: {
    options: { id: string; label: string; description: string }[];
  };
}

export interface NavigationTarget {
  tab: string;
  context?: { messageId?: string };
  shouldResolveAction: boolean;
}

export type MessageSortOrder = "newest" | "oldest";

export type DeleteModalState =
  | { mode: "single"; messageId: string; subject: string }
  | { mode: "bulk"; messageIds: string[] }
  | null;

export const UNREAD_FILTER = "__unread";

const FILTER_BUTTON_BASE_CLASS =
  "rounded-lg px-3 py-1.5 text-xs font-heading font-bold uppercase tracking-wider transition-all";
const FILTER_BUTTON_ACTIVE_CLASS = "bg-app-green text-app-bg shadow-sm";
const FILTER_BUTTON_INACTIVE_CLASS =
  "border border-app-border bg-app-card text-app-text-muted hover:bg-white/5 hover:text-app-text";

const ROUTE_TAB_MAP: Record<string, string> = {
  squad: "Squad",
  tactics: "Tactics",
  training: "Training",
  schedule: "Schedule",
  finances: "Finances",
  transfers: "Transfers",
  players: "Players",
  teams: "Teams",
  tournaments: "Tournaments",
  staff: "Staff",
  inbox: "Inbox",
  manager: "Manager",
  home: "Home",
};

const PLAYER_EVENT_MESSAGE_PREFIXES = [
  "morale_talk_",
  "bench_complaint_",
  "happy_player_",
  "contract_concern_",
];

const CATEGORY_ICONS: Record<string, ReactNode> = {
  Welcome: <Trophy className="w-4 h-4" />,
  LeagueInfo: <ClipboardList className="w-4 h-4" />,
  MatchPreview: <Crosshair className="w-4 h-4" />,
  MatchResult: <TableProperties className="w-4 h-4" />,
  Transfer: <TrendingUp className="w-4 h-4" />,
  BoardDirective: <Landmark className="w-4 h-4" />,
  PlayerMorale: <Smile className="w-4 h-4" />,
  Injury: <Stethoscope className="w-4 h-4" />,
  Training: <Dumbbell className="w-4 h-4" />,
  Finance: <DollarSign className="w-4 h-4" />,
  Contract: <FileText className="w-4 h-4" />,
  ScoutReport: <ScanSearch className="w-4 h-4" />,
  Media: <Newspaper className="w-4 h-4" />,
  System: <Info className="w-4 h-4" />,
  JobOffer: <Briefcase className="w-4 h-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  Welcome: "text-app-green",
  LeagueInfo: "text-blue-500",
  MatchPreview: "text-yellow-400",
  MatchResult: "text-yellow-500",
  Transfer: "text-purple-500",
  BoardDirective: "text-red-500",
  PlayerMorale: "text-yellow-500",
  Injury: "text-red-400",
  Training: "text-green-500",
  Finance: "text-emerald-500",
  Contract: "text-indigo-500",
  ScoutReport: "text-cyan-500",
  Media: "text-orange-500",
  System: "text-app-text-muted",
  JobOffer: "text-blue-500",
};

export function getCategoryIcon(category: string): ReactNode {
  return CATEGORY_ICONS[category] ?? CATEGORY_ICONS.System;
}

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.System;
}

export function getFilterButtonClassName(
  isActive: boolean,
  extraClasses = "",
): string {
  let className = FILTER_BUTTON_BASE_CLASS;

  if (extraClasses.length > 0) {
    className = `${className} ${extraClasses}`;
  }

  if (isActive) {
    return `${className} ${FILTER_BUTTON_ACTIVE_CLASS}`;
  }

  return `${className} ${FILTER_BUTTON_INACTIVE_CLASS}`;
}

export function getFilteredMessages(
  messages: MessageData[],
  categoryFilter: string | null,
): MessageData[] {
  if (categoryFilter === UNREAD_FILTER) {
    return messages.filter((message) => !message.read);
  }

  if (categoryFilter) {
    return messages.filter((message) => message.category === categoryFilter);
  }

  return messages;
}

function getMessageDateValue(date: string): number {
  const value = Date.parse(date);

  if (Number.isNaN(value)) {
    return 0;
  }

  return value;
}

export function sortInboxMessages(
  messages: MessageData[],
  sortOrder: MessageSortOrder,
): MessageData[] {
  return [...messages].sort((leftMessage, rightMessage) => {
    const leftDateValue = getMessageDateValue(leftMessage.date);
    const rightDateValue = getMessageDateValue(rightMessage.date);

    if (sortOrder === "oldest") {
      return leftDateValue - rightDateValue;
    }

    return rightDateValue - leftDateValue;
  });
}

export function getListPaneClassName(hasSelectedMessage: boolean): string {
  const visibilityClassName = hasSelectedMessage ? "hidden md:flex" : "flex";

  return `${visibilityClassName} min-h-0 flex-col w-full md:w-[420px] md:min-w-[420px] border-r border-app-border/60`;
}

export function getMessageRowClassName(
  isSelected: boolean,
  isRead: boolean,
): string {
  const baseClassName =
    "flex gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-app-border/30";

  if (isSelected) {
    return `${baseClassName} bg-app-green/10 border-l-2 border-l-app-green`;
  }

  if (!isRead) {
    return `${baseClassName} bg-app-bg border-l-2 border-l-app-green hover:bg-white/5`;
  }

  return `${baseClassName} border-l-2 border-l-transparent hover:bg-white/5`;
}

export function getMessageIconClassName(
  categoryColor: string,
  isSelected: boolean,
  isRead: boolean,
): string {
  const baseClassName =
    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0";

  if (isSelected) {
    return `${baseClassName} ${categoryColor} bg-app-green/10`;
  }

  if (isRead) {
    return `${baseClassName} text-app-text-muted bg-app-bg`;
  }

  return `${baseClassName} ${categoryColor} bg-app-green/10`;
}

export function getMessageSubjectClassName(isRead: boolean): string {
  if (isRead) {
    return "text-sm truncate flex-1 font-medium text-app-text-muted";
  }

  return "text-sm truncate flex-1 font-bold text-app-text";
}

export function getActionButtonClassName(action: MessageAction): string {
  const baseClassName =
    "mr-2 mb-2 rounded-lg px-5 py-2.5 text-xs font-heading font-bold uppercase tracking-wider transition-all";

  if (action.resolved) {
    return `${baseClassName} cursor-default border border-app-border bg-app-bg text-app-text-muted`;
  }

  if (
    action.action_type === "Acknowledge" ||
    action.action_type === "Dismiss"
  ) {
    return `${baseClassName} border border-app-border bg-app-card text-app-text-muted hover:bg-white/5 hover:text-app-text`;
  }

  return `${baseClassName} bg-app-green text-app-bg shadow-sm hover:bg-app-green/90`;
}

export function renderMessageBodyLine(line: string, index: number): JSX.Element {
  const baseClassName = "text-sm leading-relaxed mb-1";

  if (line.trim() === "") {
    return (
      <p key={index} className={`${baseClassName} h-3`}>
        {line}
      </p>
    );
  }

  if (line.startsWith("•")) {
    return (
      <p
        key={index}
        className={`${baseClassName} text-app-text-muted`}
      >
        <span className="flex items-start gap-2">
          <span className="text-app-green mt-0.5">•</span>
          <span>{line.replace("•", "").trim()}</span>
        </span>
      </p>
    );
  }

  return (
    <p
      key={index}
      className={`${baseClassName} text-app-text-muted`}
    >
      {line}
    </p>
  );
}

export function isNavigateAction(
  actionType: MessageAction["action_type"],
): actionType is NavigateActionType {
  return typeof actionType === "object" && "NavigateTo" in actionType;
}

export function isChooseOptionAction(
  actionType: MessageAction["action_type"],
): actionType is ChooseOptionActionType {
  return typeof actionType === "object" && "ChooseOption" in actionType;
}

export function getNavigationTarget(route: string): NavigationTarget {
  const teamMatch = route.match(/^\/team\/(.+)$/);

  if (teamMatch) {
    return {
      tab: "__selectTeam",
      context: { messageId: teamMatch[1] },
      shouldResolveAction: false,
    };
  }

  const playerMatch = route.match(/^\/player\/(.+)$/);

  if (playerMatch) {
    return {
      tab: "__selectPlayer",
      context: { messageId: playerMatch[1] },
      shouldResolveAction: false,
    };
  }

  const tabMatch = route.match(/[?&]tab=([^&]+)/i);

  if (tabMatch) {
    return {
      tab: tabMatch[1],
      shouldResolveAction: true,
    };
  }

  const simpleRoute = route.replace(/^\/+/, "").split(/[/?#]/)[0].toLowerCase();

  return {
    tab: ROUTE_TAB_MAP[simpleRoute] ?? "Home",
    shouldResolveAction: true,
  };
}

export function isPlayerEventMessage(messageId: string): boolean {
  return PLAYER_EVENT_MESSAGE_PREFIXES.some((prefix) =>
    messageId.startsWith(prefix),
  );
}
