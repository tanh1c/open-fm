import { Mail, MailOpen } from "lucide-react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { formatDateShort } from "../../lib/helpers";
import type { MessageData } from "../../store/gameStore";
import ContextMenu from "../ContextMenu";
import {
  buildDeleteMessageMenuItem,
  buildMarkMessageReadMenuItem,
  buildOpenMessageMenuItem,
} from "./inboxContextMenuItems";
import {
  getCategoryColor,
  getCategoryIcon,
  getListPaneClassName,
  getMessageIconClassName,
  getMessageRowClassName,
  getMessageSubjectClassName,
} from "./inboxHelpers";

interface InboxMessageListPaneProps {
  bulkSelectionEnabled: boolean;
  filteredMessages: MessageData[];
  hasSelectedMessage: boolean;
  language: string;
  selectedMessageId: string | null;
  selectedMessageIds: string[];
  onSelectMessage: (messageId: string) => void;
  onToggleMessageSelection: (messageId: string) => void;
  onRequestDeleteMessage: (message: MessageData) => void;
  onRequestMarkMessageRead: (messageId: string) => void;
}

export default function InboxMessageListPane({
  bulkSelectionEnabled,
  filteredMessages,
  hasSelectedMessage,
  language,
  selectedMessageId,
  selectedMessageIds,
  onSelectMessage,
  onToggleMessageSelection,
  onRequestDeleteMessage,
  onRequestMarkMessageRead,
}: InboxMessageListPaneProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className={getListPaneClassName(hasSelectedMessage)}>
      <div className="shrink-0 border-b border-app-border/50 bg-app-bg p-4">
        <h3 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">
          <Mail className="h-4 w-4 text-app-green" />
          {t("inbox.title")}
        </h3>
        <p className="mt-1 text-xs font-semibold text-app-text">
          {t("inbox.nMessages", { count: filteredMessages.length })}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
        {filteredMessages.length === 0 ? (
          <div className="p-6 text-center">
            <MailOpen className="mx-auto mb-2 h-8 w-8 text-app-text-muted" />
            <p className="text-sm text-app-text-muted">
              {t("inbox.noMessages")}
            </p>
          </div>
        ) : (
          filteredMessages.map((message) => {
            const categoryIcon = getCategoryIcon(message.category);
            const categoryColor = getCategoryColor(message.category);
            const isSelected = selectedMessageId === message.id;
            const contextItems = [
              buildOpenMessageMenuItem(t, () => onSelectMessage(message.id)),
              buildMarkMessageReadMenuItem(t, message.read, () =>
                onRequestMarkMessageRead(message.id),
              ),
              buildDeleteMessageMenuItem(t, () => onRequestDeleteMessage(message)),
            ];

            return (
              <ContextMenu items={contextItems} key={message.id}>
                <div
                  onClick={() => onSelectMessage(message.id)}
                  className={getMessageRowClassName(isSelected, message.read)}
                  data-testid={`inbox-row-${message.id}`}
                >
                  {bulkSelectionEnabled ? (
                    <div
                      className="mt-1 flex shrink-0 items-center"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedMessageIds.includes(message.id)}
                        onChange={() => onToggleMessageSelection(message.id)}
                        aria-label={t("inbox.selectMessageForDeletion", {
                          subject: message.subject,
                        })}
                        data-testid={`inbox-select-message-${message.id}`}
                        className="h-4 w-4 rounded border-app-border bg-app-bg text-app-green focus:ring-app-green/30"
                      />
                    </div>
                  ) : null}
                  <div
                    className={getMessageIconClassName(
                      categoryColor,
                      isSelected,
                      message.read,
                    )}
                  >
                    {categoryIcon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className={getMessageSubjectClassName(message.read)}>
                        {message.subject}
                      </h4>
                      {!message.read ? (
                        <span className="w-2 h-2 rounded-full bg-app-green shrink-0" />
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-app-text-muted">
                      {message.sender}
                    </p>
                    <p className="mt-0.5 text-xs text-app-text-muted">
                      {formatDateShort(message.date, language)}
                    </p>
                  </div>
                </div>
              </ContextMenu>
            );
          })
        )}
      </div>
    </div>
  );
}
