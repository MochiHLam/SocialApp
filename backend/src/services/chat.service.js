import mongoose from "mongoose";
import sharp from "sharp";
import { Readable } from "node:stream";

import { getCloudinary } from "../config/cloudinary.js";
import Conversation from "../models/Conversation.js";
import FriendRequest from "../models/FriendRequest.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { getUserPresence } from "../socket.js";
import { AppError } from "../utils/app-error.js";
import { sanitizeUser } from "./user.service.js";

const DEFAULT_MESSAGE_LIMIT = 50;
const DEFAULT_CONVERSATION_LIMIT = 50;
const DELETED_MESSAGE_PREVIEW = "This message was deleted";
const USER_SELECT_FIELDS = "displayName avatarUrl provider lastLoginAt createdAt email";

function toIdString(value) {
  return String(value);
}

function parseLimit(rawLimit, fallback, max) {
  return Math.min(Math.max(Number.parseInt(rawLimit, 10) || fallback, 1), max);
}

function buildDirectPairKey(leftId, rightId) {
  const left = toIdString(leftId);
  const right = toIdString(rightId);

  if (left === right) {
    throw new AppError("You cannot start a conversation with yourself", 400);
  }

  return [left, right].sort().join(":");
}

function assertObjectId(value, message = "Invalid id") {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(message, 400);
  }
}

function isParticipant(conversation, userId) {
  const currentId = toIdString(userId);
  return conversation.participantIds.some((participantId) => toIdString(participantId) === currentId);
}

function getOtherParticipant(conversation, currentUserId) {
  const currentId = toIdString(currentUserId);
  return conversation.participantIds.find((participant) => toIdString(participant._id || participant) !== currentId);
}

function sanitizeMessage(message) {
  const sender = message.senderId?._id ? sanitizeUser(message.senderId) : null;

  return {
    _id: String(message._id),
    id: String(message._id),
    conversationId: String(message.conversationId),
    senderId: sender?.id ? String(sender.id) : String(message.senderId),
    senderName: sender?.displayName || "",
    senderAvatar: sender?.avatarUrl || "",
    text: message.deletedAt ? "" : message.text,
    type: message.type || (message.imageUrl ? "image" : "text"),
    imageUrl: message.deletedAt ? "" : message.imageUrl,
    call: message.type === "call" && !message.deletedAt
      ? {
        callId: message.call?.callId || "",
        mode: message.call?.mode || "voice",
        status: message.call?.status || "ended",
        durationSeconds: message.call?.durationSeconds || 0,
        startedAt: message.call?.startedAt || null,
        endedAt: message.call?.endedAt || null,
      }
      : null,
    isDeleted: Boolean(message.deletedAt),
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

async function uploadChatImageBuffer(buffer) {
  const cloudinary = getCloudinary();
  const processedBuffer = await sharp(buffer)
    .rotate()
    .resize(1600, 1600, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "chatapp/messages",
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      },
    );

    Readable.from([processedBuffer]).pipe(uploadStream);
  });
}

function sanitizeConversation(conversation, currentUserId) {
  const currentId = toIdString(currentUserId);
  const hiddenAt = conversation.hiddenBy?.get?.(currentId);
  const hasVisibleLastMessage = conversation.lastMessageAt
    && (!hiddenAt || new Date(conversation.lastMessageAt).getTime() > new Date(hiddenAt).getTime());
  const otherParticipant = conversation.type === "direct"
    ? getOtherParticipant(conversation, currentUserId)
    : null;
  const otherUser = otherParticipant?._id ? sanitizeUser(otherParticipant) : null;
  const otherUserPresence = otherUser?.id ? getUserPresence(otherUser.id) : null;
  const displayName = conversation.type === "direct"
    ? otherUser?.displayName || "Unknown user"
    : conversation.name || "Group chat";
  const avatarUrl = conversation.type === "direct"
    ? otherUser?.avatarUrl || ""
    : conversation.avatarUrl || "";
  const profilePic = avatarUrl
    || (conversation.type === "group" ? "" : "https://i.pravatar.cc/100?img=1");

  return {
    id: String(conversation._id),
    conversationId: String(conversation._id),
    type: conversation.type,
    name: displayName,
    profilePic,
    avatarUrl,
    friendId: otherUser?.id ? String(otherUser.id) : null,
    ownerId: conversation.createdById ? String(conversation.createdById) : null,
    presenceStatus: conversation.type === "direct" ? otherUserPresence?.status || "offline" : "",
    lastActiveAt: conversation.type === "direct" ? otherUserPresence?.lastActiveAt || null : null,
    participants: conversation.participantIds
      .filter((participant) => participant?._id)
      .map((participant) => sanitizeUser(participant)),
    members: conversation.participantIds
      .filter((participant) => participant?._id)
      .map((participant) => sanitizeUser(participant)),
    memberCount: conversation.participantIds?.length || 0,
    preview: hasVisibleLastMessage ? conversation.lastMessageText || "No messages yet" : "No messages yet",
    lastMessageSenderId: hasVisibleLastMessage && conversation.lastMessageSenderId
      ? String(conversation.lastMessageSenderId)
      : null,
    time: hasVisibleLastMessage ? conversation.lastMessageAt : null,
    unread: conversation.unreadCounts?.get?.(currentId) || 0,
    lastMessageAt: hasVisibleLastMessage ? conversation.lastMessageAt : null,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

async function uploadGroupAvatarBuffer(buffer) {
  const cloudinary = getCloudinary();
  const processedBuffer = await sharp(buffer)
    .rotate()
    .resize(512, 512, {
      fit: "cover",
      withoutEnlargement: false,
    })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "chatapp/group-avatars",
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      },
    );

    Readable.from([processedBuffer]).pipe(uploadStream);
  });
}

function parseMemberIds(rawMemberIds) {
  if (!rawMemberIds) return [];

  if (Array.isArray(rawMemberIds)) {
    return rawMemberIds.map((memberId) => String(memberId).trim()).filter(Boolean);
  }

  if (typeof rawMemberIds === "string") {
    const trimmed = rawMemberIds.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((memberId) => String(memberId).trim()).filter(Boolean);
      }
    } catch {
      // Fall back to comma-separated values for simple form clients.
    }

    return trimmed.split(",").map((memberId) => memberId.trim()).filter(Boolean);
  }

  return [];
}

function assertGroupConversation(conversation, currentUserId) {
  if (!conversation || conversation.type !== "group" || !isParticipant(conversation, currentUserId)) {
    throw new AppError("Group conversation not found", 404);
  }
}

function assertGroupOwner(conversation, currentUserId) {
  if (toIdString(conversation.createdById) !== toIdString(currentUserId)) {
    throw new AppError("Only the group owner can perform this action", 403);
  }
}

async function ensureAcceptedFriendship(currentUserId, friendId) {
  assertObjectId(friendId, "Invalid friend id");

  const pairKeyIds = buildDirectPairKey(currentUserId, friendId).split(":");
  const relation = await FriendRequest.findOne({
    pairLowId: pairKeyIds[0],
    pairHighId: pairKeyIds[1],
    status: "accepted",
  });

  if (!relation) {
    throw new AppError("You can only message accepted friends", 403);
  }
}

export async function getOrCreateDirectConversation(currentUserId, friendId) {
  assertObjectId(friendId, "Invalid user id");

  if (toIdString(currentUserId) === toIdString(friendId)) {
    throw new AppError("You cannot message yourself", 400);
  }

  const friend = await User.findById(friendId).select(USER_SELECT_FIELDS);
  if (!friend) {
    throw new AppError("User not found", 404);
  }

  const pairKey = buildDirectPairKey(currentUserId, friendId);
  const conversation = await Conversation.findOneAndUpdate(
    { type: "direct", pairKey },
    {
      $setOnInsert: {
        type: "direct",
        participantIds: pairKey.split(":"),
        pairKey,
        createdById: currentUserId,
      },
    },
    {
      returnDocument: "after",
      upsert: true,
    },
  ).populate("participantIds", USER_SELECT_FIELDS);

  return sanitizeConversation(conversation, currentUserId);
}

export async function createGroupConversation(currentUserId, { name = "", memberIds } = {}, file) {
  const cleanName = typeof name === "string" ? name.trim() : "";
  if (!cleanName) {
    throw new AppError("Group name is required", 400);
  }
  if (cleanName.length > 80) {
    throw new AppError("Group name must be at most 80 characters long", 400);
  }

  const uniqueMemberIds = [...new Set(parseMemberIds(memberIds))]
    .filter((memberId) => toIdString(memberId) !== toIdString(currentUserId));

  for (const memberId of uniqueMemberIds) {
    assertObjectId(memberId, "Invalid member id");
    await ensureAcceptedFriendship(currentUserId, memberId);
  }

  let avatarUrl = "";
  if (file?.buffer) {
    const result = await uploadGroupAvatarBuffer(file.buffer);
    avatarUrl = result?.secure_url || "";
  }

  const conversation = await Conversation.create({
    type: "group",
    name: cleanName,
    avatarUrl,
    participantIds: [currentUserId, ...uniqueMemberIds],
    createdById: currentUserId,
  });

  const populatedConversation = await Conversation.findById(conversation._id)
    .populate("participantIds", USER_SELECT_FIELDS);

  return {
    conversation: sanitizeConversation(populatedConversation, currentUserId),
    conversationsByUserId: buildConversationPayloadsByUser(populatedConversation),
    participantIds: populatedConversation.participantIds.map((participant) => String(participant._id)),
  };
}

export async function updateGroupConversation(currentUserId, conversationId, { name } = {}, file) {
  assertObjectId(conversationId, "Invalid conversation id");

  const conversation = await Conversation.findById(conversationId);
  assertGroupConversation(conversation, currentUserId);
  assertGroupOwner(conversation, currentUserId);

  if (typeof name === "string") {
    const cleanName = name.trim();
    if (!cleanName) {
      throw new AppError("Group name is required", 400);
    }
    if (cleanName.length > 80) {
      throw new AppError("Group name must be at most 80 characters long", 400);
    }
    conversation.name = cleanName;
  }

  if (file?.buffer) {
    const result = await uploadGroupAvatarBuffer(file.buffer);
    conversation.avatarUrl = result?.secure_url || conversation.avatarUrl;
  }

  await conversation.save();

  const populatedConversation = await Conversation.findById(conversationId)
    .populate("participantIds", USER_SELECT_FIELDS);

  return {
    conversation: sanitizeConversation(populatedConversation, currentUserId),
    conversationsByUserId: buildConversationPayloadsByUser(populatedConversation),
    participantIds: populatedConversation.participantIds.map((participant) => String(participant._id)),
  };
}

export async function addGroupMember(currentUserId, conversationId, memberId) {
  assertObjectId(conversationId, "Invalid conversation id");
  assertObjectId(memberId, "Invalid member id");

  const conversation = await Conversation.findById(conversationId);
  assertGroupConversation(conversation, currentUserId);
  await ensureAcceptedFriendship(currentUserId, memberId);

  if (conversation.participantIds.some((participantId) => toIdString(participantId) === toIdString(memberId))) {
    throw new AppError("User is already a group member", 409);
  }

  const user = await User.findById(memberId).select("_id");
  if (!user) {
    throw new AppError("User not found", 404);
  }

  conversation.participantIds.push(memberId);
  conversation.hiddenBy.delete(toIdString(memberId));
  await conversation.save();

  const populatedConversation = await Conversation.findById(conversationId)
    .populate("participantIds", USER_SELECT_FIELDS);

  return {
    conversation: sanitizeConversation(populatedConversation, currentUserId),
    conversationsByUserId: buildConversationPayloadsByUser(populatedConversation),
    participantIds: populatedConversation.participantIds.map((participant) => String(participant._id)),
  };
}

export async function removeGroupMember(currentUserId, conversationId, memberId) {
  assertObjectId(conversationId, "Invalid conversation id");
  assertObjectId(memberId, "Invalid member id");

  const conversation = await Conversation.findById(conversationId);
  assertGroupConversation(conversation, currentUserId);
  assertGroupOwner(conversation, currentUserId);

  if (toIdString(memberId) === toIdString(currentUserId)) {
    throw new AppError("Use leave group instead", 400);
  }

  const initialCount = conversation.participantIds.length;
  conversation.participantIds = conversation.participantIds
    .filter((participantId) => toIdString(participantId) !== toIdString(memberId));
  conversation.unreadCounts.delete(toIdString(memberId));
  conversation.hiddenBy.delete(toIdString(memberId));

  if (conversation.participantIds.length === initialCount) {
    throw new AppError("Member not found in group", 404);
  }

  await conversation.save();

  const populatedConversation = await Conversation.findById(conversationId)
    .populate("participantIds", USER_SELECT_FIELDS);

  return {
    conversation: sanitizeConversation(populatedConversation, currentUserId),
    conversationsByUserId: buildConversationPayloadsByUser(populatedConversation),
    participantIds: populatedConversation.participantIds.map((participant) => String(participant._id)),
    removedUserId: toIdString(memberId),
  };
}

export async function leaveGroupConversation(currentUserId, conversationId) {
  assertObjectId(conversationId, "Invalid conversation id");

  const conversation = await Conversation.findById(conversationId);
  assertGroupConversation(conversation, currentUserId);

  if (toIdString(conversation.createdById) === toIdString(currentUserId)) {
    throw new AppError("Group owner must delete the group or transfer ownership first", 400);
  }

  conversation.participantIds = conversation.participantIds
    .filter((participantId) => toIdString(participantId) !== toIdString(currentUserId));
  conversation.unreadCounts.delete(toIdString(currentUserId));
  conversation.hiddenBy.delete(toIdString(currentUserId));
  await conversation.save();

  const populatedConversation = await Conversation.findById(conversationId)
    .populate("participantIds", USER_SELECT_FIELDS);

  return {
    conversation: sanitizeConversation(populatedConversation, populatedConversation.participantIds[0]?._id || currentUserId),
    conversationsByUserId: buildConversationPayloadsByUser(populatedConversation),
    participantIds: populatedConversation.participantIds.map((participant) => String(participant._id)),
    removedUserId: toIdString(currentUserId),
    conversationId: toIdString(conversationId),
  };
}

export async function deleteGroupConversation(currentUserId, conversationId) {
  assertObjectId(conversationId, "Invalid conversation id");

  const conversation = await Conversation.findById(conversationId);
  assertGroupConversation(conversation, currentUserId);
  assertGroupOwner(conversation, currentUserId);

  const participantIds = conversation.participantIds.map((participantId) => toIdString(participantId));
  await Message.deleteMany({ conversationId });
  await Conversation.deleteOne({ _id: conversationId });

  return {
    conversationId: toIdString(conversationId),
    participantIds,
  };
}

export async function listConversations(currentUserId, rawLimit = DEFAULT_CONVERSATION_LIMIT) {
  const limit = parseLimit(rawLimit, DEFAULT_CONVERSATION_LIMIT, 100);
  const currentId = toIdString(currentUserId);

  const acceptedRelations = await FriendRequest.find({
    status: "accepted",
    $or: [{ requestedById: currentUserId }, { receiverId: currentUserId }],
  }).select("requestedById receiverId");
  const existingDirectConversations = await Conversation.find({
    type: "direct",
    participantIds: currentUserId,
  }).select("pairKey");
  const existingPairKeys = new Set(existingDirectConversations.map((conversation) => conversation.pairKey));

  for (const relation of acceptedRelations) {
    const otherUserId = toIdString(relation.requestedById) === toIdString(currentUserId)
      ? relation.receiverId
      : relation.requestedById;
    const pairKey = buildDirectPairKey(currentUserId, otherUserId);

    if (existingPairKeys.has(pairKey)) continue;

    await Conversation.create({
      type: "direct",
      participantIds: pairKey.split(":"),
      pairKey,
      createdById: currentUserId,
    });
    existingPairKeys.add(pairKey);
  }

  const conversations = await Conversation.find({
    participantIds: currentUserId,
  })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .limit(limit)
    .populate("participantIds", USER_SELECT_FIELDS);

  return conversations
    .filter((conversation) => {
      const hiddenAt = conversation.hiddenBy?.get?.(currentId);
      if (!hiddenAt) return true;

      const latestActivity = conversation.lastMessageAt || conversation.updatedAt;
      return latestActivity && new Date(latestActivity).getTime() > new Date(hiddenAt).getTime();
    })
    .map((conversation) => sanitizeConversation(conversation, currentUserId));
}

export async function listMessages(currentUserId, conversationId, { limit: rawLimit, before } = {}) {
  assertObjectId(conversationId, "Invalid conversation id");

  const limit = parseLimit(rawLimit, DEFAULT_MESSAGE_LIMIT, 100);
  const conversation = await Conversation.findById(conversationId).select("participantIds hiddenBy");

  if (!conversation || !isParticipant(conversation, currentUserId)) {
    throw new AppError("Conversation not found", 404);
  }

  const messageQuery = { conversationId };
  const createdAtQuery = {};
  const hiddenAt = conversation.hiddenBy?.get?.(toIdString(currentUserId));

  if (before) {
    const beforeDate = new Date(before);
    if (Number.isNaN(beforeDate.getTime())) {
      throw new AppError("Invalid message cursor", 400);
    }
    createdAtQuery.$lt = beforeDate;
  }

  if (hiddenAt) {
    createdAtQuery.$gt = hiddenAt;
  }

  if (Object.keys(createdAtQuery).length > 0) {
    messageQuery.createdAt = createdAtQuery;
  }

  const messages = await Message.find(messageQuery)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .populate("senderId", USER_SELECT_FIELDS);

  const readResult = await markConversationRead(currentUserId, conversationId);

  const hasMore = messages.length > limit;
  const visibleMessages = hasMore ? messages.slice(0, limit) : messages;
  const orderedMessages = visibleMessages.reverse().map(sanitizeMessage);

  return {
    messages: orderedMessages,
    readConversation: readResult.conversation,
    readChanged: readResult.readChanged,
    conversationsByUserId: readResult.conversationsByUserId,
    participantIds: readResult.participantIds,
    pageInfo: {
      hasMore,
      nextBefore: orderedMessages[0]?.createdAt || null,
    },
  };
}

function buildConversationPayloadsByUser(conversation) {
  return Object.fromEntries(
    conversation.participantIds
      .filter((participant) => participant?._id)
      .map((participant) => {
        const participantId = String(participant._id);
        return [participantId, sanitizeConversation(conversation, participantId)];
      }),
  );
}

export async function sendMessage(currentUserId, conversationId, { text = "", imageUrl = "" }) {
  assertObjectId(conversationId, "Invalid conversation id");

  const cleanText = typeof text === "string" ? text.trim() : "";
  const cleanImageUrl = typeof imageUrl === "string" ? imageUrl.trim() : "";

  if (!cleanText && !cleanImageUrl) {
    throw new AppError("Message text or image is required", 400);
  }

  if (cleanText.length > 4000) {
    throw new AppError("Message must be at most 4000 characters long", 400);
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation || !isParticipant(conversation, currentUserId)) {
    throw new AppError("Conversation not found", 404);
  }

  const message = await Message.create({
    conversationId,
    senderId: currentUserId,
    text: cleanText,
    type: cleanImageUrl ? "image" : "text",
    imageUrl: cleanImageUrl,
  });

  conversation.lastMessageId = message._id;
  conversation.lastMessageText = cleanText || "Image";
  conversation.lastMessageSenderId = currentUserId;
  conversation.lastMessageAt = message.createdAt;
  for (const participantId of conversation.participantIds) {
    const participantKey = toIdString(participantId);
    if (participantKey === toIdString(currentUserId)) continue;

    const currentUnread = conversation.unreadCounts?.get(participantKey) || 0;
    conversation.unreadCounts.set(participantKey, currentUnread + 1);
  }
  await conversation.save();

  const populatedMessage = await Message.findById(message._id).populate("senderId", USER_SELECT_FIELDS);
  const populatedConversation = await Conversation.findById(conversationId).populate("participantIds", USER_SELECT_FIELDS);

  return {
    message: sanitizeMessage(populatedMessage),
    conversation: sanitizeConversation(populatedConversation, currentUserId),
    conversationsByUserId: buildConversationPayloadsByUser(populatedConversation),
    participantIds: populatedConversation.participantIds.map((participant) => String(participant._id)),
  };
}

export async function deleteMessage(currentUserId, messageId) {
  assertObjectId(messageId, "Invalid message id");

  const message = await Message.findById(messageId);
  if (!message) {
    throw new AppError("Message not found", 404);
  }

  if (toIdString(message.senderId) !== toIdString(currentUserId)) {
    throw new AppError("You can only delete your own messages", 403);
  }

  message.deletedAt = new Date();
  message.text = "";
  message.imageUrl = "";
  await message.save();

  const latestMessage = await Message.findOne({
    conversationId: message.conversationId,
  }).sort({ createdAt: -1 });

  if (latestMessage && toIdString(latestMessage._id) === toIdString(message._id)) {
    await Conversation.findByIdAndUpdate(message.conversationId, {
      lastMessageId: message._id,
      lastMessageText: DELETED_MESSAGE_PREVIEW,
      lastMessageSenderId: message.senderId,
      lastMessageAt: message.createdAt,
    });
  }

  const conversation = await Conversation.findById(message.conversationId)
    .populate("participantIds", USER_SELECT_FIELDS);

  return {
    message: sanitizeMessage(message),
    conversation: conversation ? sanitizeConversation(conversation, currentUserId) : null,
    conversationsByUserId: conversation ? buildConversationPayloadsByUser(conversation) : {},
    participantIds: conversation?.participantIds.map((participantId) => String(participantId._id || participantId)) || [],
  };
}

export async function markConversationRead(currentUserId, conversationId) {
  assertObjectId(conversationId, "Invalid conversation id");

  const conversation = await Conversation.findById(conversationId);
  if (!conversation || !isParticipant(conversation, currentUserId)) {
    throw new AppError("Conversation not found", 404);
  }

  const currentId = toIdString(currentUserId);
  const currentUnread = conversation.unreadCounts?.get(currentId) || 0;

  conversation.unreadCounts.set(currentId, 0);
  await conversation.save();

  const populatedConversation = await Conversation.findById(conversationId).populate("participantIds", USER_SELECT_FIELDS);

  return {
    conversation: sanitizeConversation(populatedConversation, currentUserId),
    conversationsByUserId: buildConversationPayloadsByUser(populatedConversation),
    readChanged: currentUnread > 0,
    participantIds: populatedConversation.participantIds.map((participant) => String(participant._id)),
  };
}

export async function hideConversation(currentUserId, conversationId) {
  assertObjectId(conversationId, "Invalid conversation id");

  const conversation = await Conversation.findById(conversationId);
  if (!conversation || !isParticipant(conversation, currentUserId)) {
    throw new AppError("Conversation not found", 404);
  }

  conversation.hiddenBy.set(toIdString(currentUserId), new Date());
  conversation.unreadCounts.set(toIdString(currentUserId), 0);
  await conversation.save();

  return {
    conversationId: String(conversation._id),
  };
}

export async function sendChatImage(currentUserId, conversationId, file) {
  if (!file?.buffer) {
    throw new AppError("Image file is required", 400);
  }

  const allowedMimeTypes = new Set(["image/png", "image/jpeg"]);
  if (!allowedMimeTypes.has(file.mimetype)) {
    throw new AppError("Only PNG and JPEG images are allowed", 400);
  }

  const result = await uploadChatImageBuffer(file.buffer);
  if (!result?.secure_url) {
    throw new AppError("Failed to upload image", 500);
  }

  return sendMessage(currentUserId, conversationId, {
    imageUrl: result.secure_url,
  });
}
