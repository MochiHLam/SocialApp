import { useState } from "react";
import ChatHeader from "./ChatHeader.jsx";
import MessageList from "./MessageList.jsx";
import MessageInput from "./MessageInput.jsx";
import {
  addGroupMember,
  deleteGroupConversation,
  leaveGroupConversation,
  removeGroupMember,
  updateGroupConversation,
} from "../../lib/api.js";
import { getThreadCacheKey } from "../../lib/chatMessageUtils.js";
import { useChatMessages } from "../../hooks/useChatMessages.js";
import { useChatTyping } from "../../hooks/useChatTyping.js";

function EmptyChatPlaceholder() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-white px-4 py-6">
      <div className="w-full max-w-md rounded-lg border border-[#e4e6eb] bg-white px-8 py-16 text-center shadow-[0_2px_4px_rgba(0,0,0,0.08),0_8px_16px_rgba(0,0,0,0.06)]">
        <p className="text-base font-semibold text-[#1c1e21]">No conversation selected yet</p>
        <p className="mt-1 text-sm text-[#65676b]">
          Choose a conversation from the sidebar to open it here.
        </p>
      </div>
    </div>
  );
}

export default function ChatSectionView({ selectedChatThread, onOpenProfile, user, onStartVoiceCall }) {
  const selectedChat = selectedChatThread || null;
  const [localGroupInfo, setLocalGroupInfo] = useState(null);
  const [composerPrefillKey, setComposerPrefillKey] = useState(0);
  const [composerPrefillText, setComposerPrefillText] = useState("");

  const displayChat = selectedChat && localGroupInfo && selectedChat.type === "group"
    ? { ...selectedChat, ...localGroupInfo }
    : selectedChat;

  const activeThreadId = selectedChat?.id;
  const activeThreadCacheKey = getThreadCacheKey(selectedChat);

  const typing = useChatTyping({
    activeThreadId,
    currentUserId: user?.id,
    selectedChat,
  });

  const chatMessages = useChatMessages({
    activeThreadId,
    activeThreadCacheKey,
    selectedChat,
    currentUserId: user?.id,
    onClearRemoteTypingUser: typing.clearRemoteTypingUser,
  });

  const applyConversationUpdate = (conversation) => {
    if (!conversation?.id) return;
    setLocalGroupInfo((prev) => ({ ...prev, ...conversation }));
  };

  const handleUpdateGroup = async ({ name, avatar }) => {
    if (!activeThreadId || selectedChat.type !== "group") return;

    const data = await updateGroupConversation({
      conversationId: activeThreadId,
      name,
      avatar,
    });
    applyConversationUpdate(data?.conversation);
  };

  const handleAddGroupMember = async (member) => {
    if (!activeThreadId || selectedChat.type !== "group") return;

    const memberId = member?.id ?? member?._id;
    if (!memberId) return;

    const data = await addGroupMember({
      conversationId: activeThreadId,
      memberId,
    });
    applyConversationUpdate(data?.conversation);
  };

  const handleRemoveGroupMember = async (member) => {
    if (!activeThreadId || selectedChat.type !== "group") return;

    const memberId = member?.id ?? member?._id;
    if (!memberId) return;

    const confirmed = window.confirm(`Remove ${member.displayName || "this member"} from the group?`);
    if (!confirmed) return;

    const data = await removeGroupMember({
      conversationId: activeThreadId,
      memberId,
    });
    applyConversationUpdate(data?.conversation);
  };

  const handleDeleteGroup = async () => {
    if (!activeThreadId || selectedChat.type !== "group") return;

    const confirmed = window.confirm(`Delete group "${displayChat?.name}"?`);
    if (!confirmed) return;

    try {
      await deleteGroupConversation({ conversationId: activeThreadId });
    } catch (err) {
      window.alert(err.message || "Failed to delete group");
    }
  };

  const handleLeaveGroup = async () => {
    if (!activeThreadId || selectedChat.type !== "group") return;

    const confirmed = window.confirm(`Leave group "${displayChat?.name}"?`);
    if (!confirmed) return;

    try {
      await leaveGroupConversation({ conversationId: activeThreadId });
    } catch (err) {
      window.alert(err.message || "Failed to leave group");
    }
  };

  const handleOpenChatProfile = () => {
    if (!selectedChat || selectedChat.type === "group") return;
    const friendId = selectedChat.friendId ?? selectedChat.otherUserId;
    if (!friendId) return;
    onOpenProfile?.({
      id: friendId,
      displayName: selectedChat.name,
      avatarUrl: selectedChat.profilePic,
    });
  };

  const handleApplySuggestedReply = (text) => {
    setComposerPrefillText(text);
    setComposerPrefillKey((prevKey) => prevKey + 1);
  };

  const wrapSend = (sendFn) => async (...args) => {
    typing.stopLocalTyping();
    return sendFn(...args);
  };

  if (!selectedChat) return <EmptyChatPlaceholder />;

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatHeader
          chat={displayChat}
          currentUser={user}
          onCall={{ voice: () => onStartVoiceCall?.(displayChat) }}
          onOpenProfile={handleOpenChatProfile}
          canOpenProfile={selectedChat.type !== "group"}
          onUpdateGroup={handleUpdateGroup}
          onAddMember={handleAddGroupMember}
          onRemoveMember={handleRemoveGroupMember}
          onDeleteGroup={handleDeleteGroup}
          onLeaveGroup={handleLeaveGroup}
        />

        <MessageList
          messages={chatMessages.messages}
          currentUserId={user?.id}
          isGroupChat={selectedChat.type === "group"}
          onDeleteMessage={chatMessages.handleDeleteMessage}
          isLoading={chatMessages.isLoading}
          error={chatMessages.error}
          hasOlderMessages={chatMessages.hasOlderMessages}
          isLoadingOlder={chatMessages.isLoadingOlder}
          initialUnreadCount={chatMessages.initialUnreadCount}
          threadId={activeThreadId}
          onLoadOlderMessages={chatMessages.handleLoadOlderMessages}
          onApplySuggestedReply={handleApplySuggestedReply}
        />

        {typing.typingLabel && (
          <div className="border-t border-[#f0f2f5] px-4 py-1.5 text-xs font-medium text-[#65676b]">
            {typing.typingLabel}
          </div>
        )}

        <MessageInput
          onSend={wrapSend(chatMessages.handleSendMessage)}
          onAttachImage={wrapSend(chatMessages.handleAttachImage)}
          onTypingChange={typing.handleTypingChange}
          prefillKey={composerPrefillKey}
          prefillText={composerPrefillText}
        />
      </div>
    </section>
  );
}
