import { useEffect, useRef, useState } from "react";
import { formatFullMessageTime, formatMessengerTime } from "../../lib/timeFormat.js";

function getMessageDayKey(createdAt) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
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
}) {
  const listRef = useRef(null);
  const olderScrollPositionRef = useRef(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const lastMessageId = messages[messages.length - 1]?._id || "";

  useEffect(() => {
    if (!listRef.current) return;
    if (olderScrollPositionRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [lastMessageId]);

  useEffect(() => {
    const listElement = listRef.current;
    const previousPosition = olderScrollPositionRef.current;
    if (!listElement || !previousPosition || isLoadingOlder) return;

    listElement.scrollTop =
      listElement.scrollHeight - previousPosition.scrollHeight + previousPosition.scrollTop;
    olderScrollPositionRef.current = null;
  }, [isLoadingOlder, messages.length]);

  useEffect(() => {
    const handleWindowClick = () => {
      setOpenMenuId(null);
    };

    window.addEventListener("click", handleWindowClick);
    return () => {
      window.removeEventListener("click", handleWindowClick);
    };
  }, []);

  const handleScroll = () => {
    const listElement = listRef.current;
    if (!listElement || !hasOlderMessages || isLoadingOlder || !onLoadOlderMessages) return;
    if (listElement.scrollTop > 80) return;

    olderScrollPositionRef.current = {
      scrollHeight: listElement.scrollHeight,
      scrollTop: listElement.scrollTop,
    };
    onLoadOlderMessages();
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-8 text-sm text-[#65676b]">
        Loading messages...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-8 text-sm text-red-500">
        {error}
      </div>
    );
  }

  if (!messages.length) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-8 text-sm text-[#65676b]">
        No messages yet. Send a message to start the conversation.
      </div>
    );
  }

  return (
    <div ref={listRef} onScroll={handleScroll} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
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
        const fullTimeLabel = formatFullMessageTime(message.createdAt);
        const bubbleClassName = message.isDeleted
          ? "bg-[#f0f2f5] text-[#65676b]"
          : isMine
            ? "bg-blue-500 text-white"
            : "bg-[#f0f2f5] text-[#1c1e21]";

        return (
          <div key={message._id} className="space-y-3">
            {shouldShowTimeDivider && (
              <div className="flex justify-center">
                <span className="rounded-full bg-[#f0f2f5] px-3 py-1 text-[11px] font-semibold text-[#65676b]">
                  {formatMessengerTime(message.createdAt)}
                </span>
              </div>
            )}

            <div className={`group flex w-full ${isMine ? "justify-end" : "justify-start"}`}>
              {!isMine && isGroupChat && (
                <img
                  src={message.senderAvatar || "https://i.pravatar.cc/100?img=1"}
                  alt={message.senderName || "Member"}
                  className="mr-2 mt-1 h-7 w-7 rounded-full object-cover ring-1 ring-black/5"
                />
              )}

              <div className={`relative flex max-w-[75%] flex-col ${isMine ? "items-end" : "items-start"}`}>
                <div
                  className={`peer w-fit max-w-full rounded-2xl px-3 py-2 ${bubbleClassName}`}
                  title={fullTimeLabel}
                >
                  {message.isDeleted ? (
                    <p className="break-words whitespace-pre-wrap text-sm italic">This message was deleted</p>
                  ) : (
                    <>
                      {message.imageUrl && (
                        <img
                          src={message.imageUrl}
                          alt=""
                          className="mb-2 max-h-[280px] max-w-full rounded-xl object-contain"
                        />
                      )}
                      {message.text && <p className="break-words whitespace-pre-wrap text-sm">{message.text}</p>}
                    </>
                  )}
                </div>
                {fullTimeLabel && (
                  <span
                    className={`pointer-events-none absolute top-1/2 z-10 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-[#242526] px-2 py-1 text-[11px] font-semibold text-white shadow-lg peer-hover:block ${
                      isMine ? "right-full mr-2" : "left-full ml-2"
                    }`}
                  >
                    {fullTimeLabel}
                  </span>
                )}

                {isMine && !message.isDeleted && (
                  <>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenMenuId((prevId) => (prevId === message._id ? null : message._id));
                      }}
                      className="absolute -bottom-2 -left-8 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#65676b] opacity-0 shadow transition hover:bg-[#f0f2f5] group-hover:opacity-100"
                      aria-label="Open message actions"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M3 10a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0z" />
                      </svg>
                    </button>

                    {openMenuId === message._id && (
                      <div
                        onClick={(event) => event.stopPropagation()}
                        className="absolute -bottom-2 -left-36 z-10 min-w-[120px] rounded-md border border-[#e4e6eb] bg-white py-1 shadow-lg"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (onDeleteMessage) onDeleteMessage(message._id);
                            setOpenMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-red-500 transition hover:bg-red-50"
                        >
                          Delete message
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
