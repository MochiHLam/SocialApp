export function appendMessageOnce(messages, nextMessage) {
  if (!nextMessage?._id) return messages;
  if (messages.some((message) => message._id === nextMessage._id)) return messages;
  return [...messages, nextMessage];
}

export function getThreadCacheKey(thread) {
  if (!thread?.id) return "";
  return `${thread.id}:${thread.time || thread.lastMessageAt || ""}`;
}

export function getMessageDayKey(createdAt) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function getDeletedMessagePatch(messageId) {
  return (message) => (
    message._id === messageId
      ? { ...message, text: "", imageUrl: "", isDeleted: true }
      : message
  );
}

export function mergeOlderMessages(prevMessages, olderMessages) {
  const existingIds = new Set(prevMessages.map((message) => message._id));
  return [
    ...olderMessages.filter((message) => !existingIds.has(message._id)),
    ...prevMessages,
  ];
}
