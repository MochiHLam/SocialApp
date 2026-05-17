import { useEffect, useState } from "react";
import { getMessageDayKey } from "../../lib/chatMessageUtils.js";
import { useFrozenUnreadMarkers } from "../../hooks/useFrozenUnreadMarkers.js";
import { useMessageListScroll } from "../../hooks/useMessageListScroll.js";
import { useUnreadSummarize } from "../../hooks/useUnreadSummarize.js";
import { formatMessengerTime } from "../../lib/timeFormat.js";
import MessageBubble from "./MessageBubble.jsx";
import UnreadSummarizePanel from "./UnreadSummarizePanel.jsx";
import { SummarizeUnreadButton, UnreadCountBanner } from "./UnreadMessageMarkers.jsx";

function ListStatus({ children, className = "text-[#65676b]" }) {
  return (
    <div className={`flex flex-1 items-center justify-center px-4 py-8 text-sm ${className}`}>
      {children}
    </div>
  );
}

export default function MessageList({
  messages,
  currentUserId,
  isGroupChat,
  onDeleteMessage,
  isLoading = false,
  hasOlderMessages = false,
  isLoadingOlder = false,
  onLoadOlderMessages,
  error = "",
  initialUnreadCount = 0,
  threadId = null,
  onApplySuggestedReply,
}) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const { listRef, handleScroll } = useMessageListScroll({
    messages,
    isLoadingOlder,
    onLoadOlderMessages,
    hasOlderMessages,
  });

  const summarize = useUnreadSummarize({ messages, threadId, onApplySuggestedReply });
  const { markers, showUnreadUi } = useFrozenUnreadMarkers({
    messages,
    initialUnreadCount,
    threadId,
    unreadUiDismissed: summarize.unreadUiDismissed,
  });

  useEffect(() => {
    const handleWindowClick = () => setOpenMenuId(null);
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, []);

  if (isLoading) return <ListStatus>Loading messages...</ListStatus>;
  if (error) return <ListStatus className="text-red-500">{error}</ListStatus>;
  if (!messages.length) {
    return (
      <ListStatus>
        No messages yet. Send a message to start the conversation.
      </ListStatus>
    );
  }

  return (
    <div
      ref={listRef}
      onScroll={handleScroll}
      className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
    >
      {hasOlderMessages && (
        <div className="flex h-8 items-center justify-center text-xs font-semibold text-[#65676b]">
          {isLoadingOlder ? "Loading older messages..." : "Scroll up for older messages"}
        </div>
      )}

      {messages.map((message, index) => {
        const isMine = message.senderId === currentUserId;
        const messageDayKey = getMessageDayKey(message.createdAt);
        const previousMessageDayKey = getMessageDayKey(messages[index - 1]?.createdAt);
        const shouldShowTimeDivider = messageDayKey && messageDayKey !== previousMessageDayKey;

        return (
          <div key={message._id} className="space-y-3">
            {showUnreadUi && message._id === markers.firstId && (
              <UnreadCountBanner count={markers.count} />
            )}

            {shouldShowTimeDivider && (
              <div className="flex justify-center">
                <span className="rounded-full bg-[#f0f2f5] px-3 py-1 text-[11px] font-semibold text-[#65676b]">
                  {formatMessengerTime(message.createdAt)}
                </span>
              </div>
            )}

            <MessageBubble
              message={message}
              isMine={isMine}
              isGroupChat={isGroupChat}
              openMenuId={openMenuId}
              onToggleMenu={(messageId) => (
                setOpenMenuId((prevId) => (prevId === messageId ? null : messageId))
              )}
              onDeleteMessage={(messageId) => {
                onDeleteMessage?.(messageId);
                setOpenMenuId(null);
              }}
            />

            {showUnreadUi && message._id === markers.lastId && (
              <SummarizeUnreadButton onClick={() => summarize.open(markers)} />
            )}
          </div>
        );
      })}

      <UnreadSummarizePanel
        isOpen={summarize.isOpen}
        unreadCount={markers?.count ?? initialUnreadCount}
        isLoadingSummary={summarize.isLoadingSummary}
        summaryBullets={summarize.summaryBullets}
        isLoadingSuggestions={summarize.isLoadingSuggestions}
        suggestions={summarize.suggestions}
        showSuggestions={summarize.showSuggestions}
        onClose={summarize.close}
        onSuggestResponses={summarize.suggestResponses}
        onSelectSuggestion={summarize.selectSuggestion}
      />
    </div>
  );
}
