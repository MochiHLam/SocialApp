export function getConversationSortTime(conversation) {
  return new Date(
    conversation?.time || conversation?.lastMessageAt || conversation?.updatedAt || 0,
  ).getTime();
}

export function formatConversationPreview(chat, currentUserId) {
  const previewText = (chat.preview || "").trim();
  if (!previewText || previewText === "No messages yet") return "No messages yet.";
  if (previewText === "This message was deleted") return previewText;
  if (
    chat.lastMessageSenderId
    && currentUserId
    && String(chat.lastMessageSenderId) === String(currentUserId)
  ) {
    return `You: ${previewText}`;
  }
  return previewText;
}
