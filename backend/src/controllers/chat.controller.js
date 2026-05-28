import {
  summarizeMessageBatch,
  suggestRepliesForMessageBatch,
} from "../services/chatAi.service.js";
import {
  addGroupMember,
  createGroupConversation,
  deleteMessage,
  deleteGroupConversation,
  getOrCreateDirectConversation,
  hideConversation,
  leaveGroupConversation,
  listConversations,
  listMessages,
  markConversationRead,
  removeGroupMember,
  sendChatImage,
  sendMessage,
  updateGroupConversation,
} from "../services/chat.service.js";
import { emitToUser } from "../socket.js";

function emitChatEventWithUserConversation(participantIds, eventName, payload, conversationsByUserId = {}) {
  for (const participantId of participantIds) {
    emitToUser(participantId, eventName, {
      ...payload,
      conversation: conversationsByUserId[String(participantId)] || payload.conversation || null,
      changedAt: new Date().toISOString(),
    });
  }
}

/** GET /chat/conversations */
export async function getConversationsHandler(req, res) {
  const conversations = await listConversations(req.user.id, req.query.limit);

  res.json({
    success: true,
    conversations,
  });
}

/** POST /chat/conversations/direct/:friendId */
export async function createDirectConversationHandler(req, res) {
  const conversation = await getOrCreateDirectConversation(req.user.id, req.params.friendId);

  res.status(201).json({
    success: true,
    conversation,
  });
}

/** POST /chat/conversations/group */
export async function createGroupConversationHandler(req, res) {
  const result = await createGroupConversation(req.user.id, req.body, req.file);

  emitChatEventWithUserConversation(result.participantIds, "chat:conversation_updated", {
    conversationId: result.conversation.id,
    conversation: result.conversation,
  }, result.conversationsByUserId);

  res.status(201).json({
    success: true,
    conversation: result.conversation,
  });
}

/** PATCH /chat/conversations/:conversationId/group */
export async function updateGroupConversationHandler(req, res) {
  const result = await updateGroupConversation(req.user.id, req.params.conversationId, req.body, req.file);

  emitChatEventWithUserConversation(result.participantIds, "chat:conversation_updated", {
    conversationId: result.conversation.id,
    conversation: result.conversation,
  }, result.conversationsByUserId);

  res.json({
    success: true,
    conversation: result.conversation,
  });
}

/** POST /chat/conversations/:conversationId/members */
export async function addGroupMemberHandler(req, res) {
  const result = await addGroupMember(req.user.id, req.params.conversationId, req.body.memberId);

  emitChatEventWithUserConversation(result.participantIds, "chat:conversation_updated", {
    conversationId: result.conversation.id,
    conversation: result.conversation,
  }, result.conversationsByUserId);

  res.status(201).json({
    success: true,
    conversation: result.conversation,
  });
}

/** DELETE /chat/conversations/:conversationId/members/:memberId */
export async function removeGroupMemberHandler(req, res) {
  const result = await removeGroupMember(req.user.id, req.params.conversationId, req.params.memberId);

  emitChatEventWithUserConversation(result.participantIds, "chat:conversation_updated", {
    conversationId: result.conversation.id,
    conversation: result.conversation,
  }, result.conversationsByUserId);
  emitToUser(result.removedUserId, "chat:conversation_removed", {
    conversationId: result.conversation.id,
    changedAt: new Date().toISOString(),
  });

  res.json({
    success: true,
    conversation: result.conversation,
  });
}

/** POST /chat/conversations/:conversationId/leave */
export async function leaveGroupConversationHandler(req, res) {
  const result = await leaveGroupConversation(req.user.id, req.params.conversationId);

  emitChatEventWithUserConversation(result.participantIds, "chat:conversation_updated", {
    conversationId: result.conversationId,
    conversation: result.conversation,
  }, result.conversationsByUserId);
  emitToUser(result.removedUserId, "chat:conversation_removed", {
    conversationId: result.conversationId,
    changedAt: new Date().toISOString(),
  });

  res.json({
    success: true,
    conversationId: result.conversationId,
  });
}

/** DELETE /chat/conversations/:conversationId */
export async function deleteGroupConversationHandler(req, res) {
  const result = await deleteGroupConversation(req.user.id, req.params.conversationId);

  for (const participantId of result.participantIds) {
    emitToUser(participantId, "chat:conversation_removed", {
      conversationId: result.conversationId,
      changedAt: new Date().toISOString(),
    });
  }

  res.json({
    success: true,
    conversationId: result.conversationId,
  });
}

/** GET /chat/conversations/:conversationId/messages */
export async function getMessagesHandler(req, res) {
  const result = await listMessages(req.user.id, req.params.conversationId, req.query);

  if (result.readChanged) {
    emitChatEventWithUserConversation(result.participantIds, "chat:conversation_read", {
      conversationId: result.readConversation.id,
      userId: String(req.user.id),
      conversation: result.readConversation,
    }, result.conversationsByUserId);
  }

  res.json({
    success: true,
    messages: result.messages,
    pageInfo: result.pageInfo,
  });
}

/** POST /chat/conversations/:conversationId/messages */
export async function sendMessageHandler(req, res) {
  const result = await sendMessage(req.user.id, req.params.conversationId, req.body);

  emitChatEventWithUserConversation(result.participantIds, "chat:message_created", {
    conversationId: result.conversation.id,
    message: result.message,
    conversation: result.conversation,
  }, result.conversationsByUserId);

  res.status(201).json({
    success: true,
    message: result.message,
    conversation: result.conversation,
  });
}

/** POST /chat/conversations/:conversationId/images */
export async function sendImageMessageHandler(req, res) {
  const result = await sendChatImage(req.user.id, req.params.conversationId, req.file);

  emitChatEventWithUserConversation(result.participantIds, "chat:message_created", {
    conversationId: result.conversation.id,
    message: result.message,
    conversation: result.conversation,
  }, result.conversationsByUserId);

  res.status(201).json({
    success: true,
    message: result.message,
    conversation: result.conversation,
  });
}

/** PATCH /chat/conversations/:conversationId/read */
export async function markConversationReadHandler(req, res) {
  const result = await markConversationRead(req.user.id, req.params.conversationId);

  emitChatEventWithUserConversation(result.participantIds, "chat:conversation_read", {
    conversationId: result.conversation.id,
    userId: String(req.user.id),
    conversation: result.conversation,
  }, result.conversationsByUserId);

  res.json({
    success: true,
    conversation: result.conversation,
  });
}

/** PATCH /chat/conversations/:conversationId/hide */
export async function hideConversationHandler(req, res) {
  const result = await hideConversation(req.user.id, req.params.conversationId);

  res.json({
    success: true,
    conversationId: result.conversationId,
  });
}

/** DELETE /chat/messages/:messageId */
export async function deleteMessageHandler(req, res) {
  const result = await deleteMessage(req.user.id, req.params.messageId);

  emitChatEventWithUserConversation(result.participantIds, "chat:message_deleted", {
    conversationId: result.message.conversationId,
    message: result.message,
    conversation: result.conversation,
  }, result.conversationsByUserId);

  res.json({
    success: true,
    message: result.message,
  });
}

/** POST /chat/conversations/:conversationId/ai/summarize */
export async function summarizeMessagesHandler(req, res) {
  const { endMessageId, startMessageId, maxMessages } = req.body;
  if (!endMessageId) {
    return res.status(400).json({ message: "endMessageId is required" });
  }

  const result = await summarizeMessageBatch(req.user.id, req.params.conversationId, {
    endMessageId,
    startMessageId,
    maxMessages,
  });

  res.json({ success: true, summaryBullets: result.bullets, meta: result.meta });
}

/** POST /chat/conversations/:conversationId/ai/suggest-replies */
export async function suggestRepliesHandler(req, res) {
  const { endMessageId, startMessageId, maxMessages } = req.body;
  if (!endMessageId) {
    return res.status(400).json({ message: "endMessageId is required" });
  }

  const result = await suggestRepliesForMessageBatch(req.user.id, req.params.conversationId, {
    endMessageId,
    startMessageId,
    maxMessages,
  });

  res.json({ success: true, replies: result.replies, meta: result.meta });
}