import { useState } from "react";
import { useChatConversations } from "../../hooks/useChatConversations.js";
import ConversationRow from "./ConversationRow.jsx";
import CreateGroupModal from "./CreateGroupModal.jsx";

export default function ChatSidebarSecondaryPanel({
  selectedChatId,
  onSelectChat,
  currentUserId,
  onCreateGroup,
}) {
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const {
    conversations,
    isLoading,
    error,
    hideConversation,
    createGroup,
  } = useChatConversations({ selectedChatId, onSelectChat });

  const handleDeleteChat = async (chat) => {
    const confirmed = window.confirm("Delete this chat from your inbox?");
    if (!confirmed) return;
    await hideConversation(chat);
  };

  return (
    <>
      <aside className="flex h-full w-[300px] shrink-0 flex-col overflow-hidden border-r border-[#e4e6eb] bg-white">
        <div className="flex-1 space-y-4 overflow-y-auto p-3">
          <div className="space-y-0.5">
            <div className="flex items-center justify-between px-3 pb-1 pt-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#8a8d91]">Recent</p>
              <button
                type="button"
                id="btn-create-group-chat"
                onClick={() => setCreateGroupOpen(true)}
                aria-label="Create group chat"
                title="Create group chat"
                className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700 active:scale-95"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>

            {isLoading && (
              <p className="px-3 py-2 text-sm font-normal text-[#65676b]">Loading conversations...</p>
            )}
            {!isLoading && error && (
              <p className="px-3 py-2 text-sm font-normal text-red-500">{error}</p>
            )}
            {!isLoading && !error && conversations.length === 0 && (
              <p className="px-3 py-2 text-sm font-normal text-[#65676b]">No conversations yet.</p>
            )}
            {!isLoading && !error && conversations.map((chat) => (
              <ConversationRow
                key={chat.id}
                chat={chat}
                currentUserId={currentUserId}
                isActive={selectedChatId === chat.id}
                onSelectChat={onSelectChat}
                onDeleteChat={handleDeleteChat}
              />
            ))}
          </div>
        </div>
      </aside>

      {createGroupOpen && (
        <CreateGroupModal
          onClose={() => setCreateGroupOpen(false)}
          onCreate={async ({ name, avatar }) => {
            try {
              const conversation = await createGroup({ name, avatar });
              setCreateGroupOpen(false);
              onCreateGroup?.(conversation);
            } catch (err) {
              window.alert(err.message || "Failed to create group chat");
            }
          }}
        />
      )}
    </>
  );
}
