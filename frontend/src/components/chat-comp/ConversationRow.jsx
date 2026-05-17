import { useState } from "react";
import { formatConversationPreview } from "../../lib/chatConversationUtils.js";
import { getPresenceDotClassName } from "../../lib/chatPresence.js";
import { getAvatarUrl } from "../../lib/avatarUrl.js";
import { formatMessengerTime } from "../../lib/timeFormat.js";

export default function ConversationRow({
  chat,
  currentUserId,
  isActive,
  onSelectChat,
  onDeleteChat,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const timeLabel = formatMessengerTime(chat.time);

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onSelectChat(chat)}
        className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 pr-9 text-left text-sm font-semibold transition-colors ${
          isActive ? "bg-indigo-50 text-indigo-600" : "text-[#1c1e21] hover:bg-[#f0f2f5]"
        }`}
      >
        <span className="relative h-10 w-10 shrink-0">
          <img
            src={getAvatarUrl(chat.profilePic, chat.type)}
            alt={chat.name}
            className="h-10 w-10 rounded-full object-cover ring-1 ring-black/5"
          />
          {chat.type !== "group" && (
            <span
              className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${getPresenceDotClassName(chat.presenceStatus)}`}
              title={chat.presenceStatus || "offline"}
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate">{chat.name}</span>
            <span className="shrink-0 text-xs font-normal text-[#8a8d91]">{timeLabel}</span>
          </div>
          <p className="truncate text-xs font-normal text-[#65676b]">
            {formatConversationPreview(chat, currentUserId)}
          </p>
        </div>
        {chat.unread > 0 && (
          <span className="mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center self-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">
            {chat.unread}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setMenuOpen((prev) => !prev);
        }}
        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#65676b] opacity-0 transition hover:bg-white group-hover:opacity-100"
        aria-label="Open conversation actions"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M3 10a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0z" />
        </svg>
      </button>

      {menuOpen && (
        <div className="absolute right-2 top-11 z-20 min-w-[130px] rounded-md border border-[#e4e6eb] bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen(false);
              onDeleteChat(chat);
            }}
            className="w-full px-3 py-2 text-left text-sm text-red-500 transition hover:bg-red-50"
          >
            Delete chat
          </button>
        </div>
      )}
    </div>
  );
}
