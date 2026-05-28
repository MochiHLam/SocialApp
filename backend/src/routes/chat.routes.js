import { Router } from "express";

import {
  addGroupMemberHandler,
  createGroupConversationHandler,
  createDirectConversationHandler,
  deleteMessageHandler,
  deleteGroupConversationHandler,
  getConversationsHandler,
  getMessagesHandler,
  hideConversationHandler,
  leaveGroupConversationHandler,
  markConversationReadHandler,
  removeGroupMemberHandler,
  sendImageMessageHandler,
  sendMessageHandler,
  summarizeMessagesHandler,
  suggestRepliesHandler,
  updateGroupConversationHandler,
} from "../controllers/chat.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { chatImageUpload, groupAvatarUpload } from "../middlewares/upload.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

router.get("/conversations", requireAuth, asyncHandler(getConversationsHandler));
router.post("/conversations/direct/:friendId", requireAuth, asyncHandler(createDirectConversationHandler));
router.post(
  "/conversations/group",
  requireAuth,
  groupAvatarUpload.single("avatar"),
  asyncHandler(createGroupConversationHandler),
);
router.patch(
  "/conversations/:conversationId/group",
  requireAuth,
  groupAvatarUpload.single("avatar"),
  asyncHandler(updateGroupConversationHandler),
);
router.post("/conversations/:conversationId/members", requireAuth, asyncHandler(addGroupMemberHandler));
router.delete("/conversations/:conversationId/members/:memberId", requireAuth, asyncHandler(removeGroupMemberHandler));
router.post("/conversations/:conversationId/leave", requireAuth, asyncHandler(leaveGroupConversationHandler));
router.get("/conversations/:conversationId/messages", requireAuth, asyncHandler(getMessagesHandler));
router.post("/conversations/:conversationId/messages", requireAuth, asyncHandler(sendMessageHandler));
router.post("/conversations/:conversationId/images", requireAuth, chatImageUpload.single("image"), asyncHandler(sendImageMessageHandler));
router.patch("/conversations/:conversationId/read", requireAuth, asyncHandler(markConversationReadHandler));
router.patch("/conversations/:conversationId/hide", requireAuth, asyncHandler(hideConversationHandler));
router.delete("/conversations/:conversationId", requireAuth, asyncHandler(deleteGroupConversationHandler));
router.delete("/messages/:messageId", requireAuth, asyncHandler(deleteMessageHandler));
router.post("/conversations/:conversationId/ai/summarize", requireAuth, asyncHandler(summarizeMessagesHandler));
router.post("/conversations/:conversationId/ai/suggest-replies", requireAuth, asyncHandler(suggestRepliesHandler));

export default router;
