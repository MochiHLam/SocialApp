import { formatFullMessageTime } from "../../lib/timeFormat.js";
import CallMessageBubble from "./CallMessageBubble.jsx";

export default function MessageBubble({
  message,
  isMine,
  isGroupChat,
  openMenuId,
  onToggleMenu,
  onDeleteMessage,
}) {
  const isCallMessage = message.type === "call";
  const fullTimeLabel = formatFullMessageTime(message.createdAt);
  const bubbleClassName = message.isDeleted
    ? "bg-[#f0f2f5] text-[#65676b]"
    : isMine
      ? "bg-blue-500 text-white"
      : "bg-[#f0f2f5] text-[#1c1e21]";

  const rowClass = `group flex w-full ${isMine ? "justify-end" : "justify-start"}`;
  const columnClass = `relative flex max-w-[75%] flex-col ${isMine ? "items-end" : "items-start"}`;
  const hoverTimeClass = `pointer-events-none absolute top-1/2 z-10 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-[#242526] px-2 py-1 text-[11px] font-semibold text-white shadow-lg peer-hover:block ${
    isMine ? "right-full mr-2" : "left-full ml-2"
  }`;

  return (
    <div className={rowClass}>
      {!isMine && isGroupChat && (
        <img
          src={message.senderAvatar || "https://i.pravatar.cc/100?img=1"}
          alt={message.senderName || "Member"}
          className="mr-2 mt-1 h-7 w-7 rounded-full object-cover ring-1 ring-black/5"
        />
      )}

      <div className={columnClass}>
        <div
          className={`peer w-fit max-w-full rounded-2xl px-3 py-2 ${bubbleClassName}`}
          title={fullTimeLabel}
        >
          {message.isDeleted ? (
            <p className="break-words whitespace-pre-wrap text-sm italic">This message was deleted</p>
          ) : isCallMessage ? (
            <CallMessageBubble message={message} isMine={isMine} />
          ) : (
            <>
              {message.imageUrl && (
                <img
                  src={message.imageUrl}
                  alt=""
                  className="mb-2 max-h-[280px] max-w-full rounded-xl object-contain"
                />
              )}
              {message.text && (
                <p className="break-words whitespace-pre-wrap text-sm">{message.text}</p>
              )}
            </>
          )}
        </div>

        {fullTimeLabel && <span className={hoverTimeClass}>{fullTimeLabel}</span>}

        {isMine && !message.isDeleted && !isCallMessage && (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleMenu(message._id);
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
                  onClick={() => onDeleteMessage(message._id)}
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
  );
}
