import mongoose from "mongoose";

import { generateGeminiJson } from "../lib/gemini.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { AppError } from "../utils/app-error.js";
import { censorText, containsBadWords, isCleanText } from "../utils/bad-words.util.js";

const MAX_BATCH_MESSAGES = 50;
const STYLE_SAMPLE_COUNT = 15;
const MAX_LINE_LENGTH = 200;
const SAFE_REPLY_FALLBACKS = [
  "Okay, I'll get back to you soon.",
  "Thanks for letting me know!",
  "Got it, let me check and reply properly.",
];

// Throws 400 if value is not a valid MongoDB ObjectId
function assertObjectId(value, message = "Invalid id") {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(message, 400);
  }
}

// Checks whether a user is a participant of the given conversation
function isParticipant(conversation, userId) {
  const currentId = String(userId);
  return conversation.participantIds.some(
    (participantId) => String(participantId._id || participantId) === currentId,
  );
}

// Fetches conversation and throws 404 if user is not a participant
async function assertParticipant(conversationId, viewerUserId) {
  assertObjectId(conversationId, "Invalid conversation id");

  const conversation = await Conversation.findById(conversationId).select("participantIds");
  if (!conversation || !isParticipant(conversation, viewerUserId)) {
    throw new AppError("Conversation not found", 404);
  }

  return conversation;
}

// Trims and truncates text to a max character length with ellipsis
function clipText(text, max = MAX_LINE_LENGTH) {
  const clean = (text || "").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

// Formats a single message into a readable "Name: text" line.
// Returns null for call messages and deleted messages so they can be filtered out.
function formatMessageLine(message, viewerUserId) {
  // Bỏ qua tin nhắn bị xóa
  if (message.isDeleted || message.deletedAt) return null;
  // Bỏ qua tin nhắn cuộc gọi
  if (message.type === "call") return null;

  const senderId = String(message.senderId?._id || message.senderId);
  const isViewer = senderId === String(viewerUserId);
  const senderName = isViewer
    ? "Bạn"
    : (message.senderId?.displayName || "Họ");

  if (message.type === "image") return `${senderName}: [hình ảnh]`;

  const text = clipText(message.text);
  if (!text) return null;
  return `${senderName}: ${text}`;
}

// Converts an array of messages into a plain-text transcript string,
// skipping calls, deleted messages, and empty lines.
function formatTranscript(messages, viewerUserId) {
  const ordered = [...messages].reverse();
  if (!ordered.length) return "(không có tin nhắn)";

  const lines = ordered
    .map((message) => formatMessageLine(message, viewerUserId))
    .filter(Boolean);

  return lines.length ? lines.join("\n") : "(không có tin nhắn hợp lệ)";
}

// Fetches messages between startMessage and endMessage (inclusive), or up to N messages up to endMessage
async function getMessagesBatch(conversationId, endMessageId, maxMessages, startMessageId) {
  assertObjectId(endMessageId, "Invalid endMessageId");

  const endMessage = await Message.findOne({
    _id: endMessageId,
    conversationId,
    deletedAt: null,
  });

  if (!endMessage) {
    throw new AppError("Invalid snapshot cursor", 400);
  }

  // Mode: from startMessage to endMessage
  if (startMessageId) {
    assertObjectId(startMessageId, "Invalid startMessageId");

    const startMessage = await Message.findOne({
      _id: startMessageId,
      conversationId,
      deletedAt: null,
    });

    if (!startMessage) {
      throw new AppError("Invalid start message", 400);
    }

    return Message.find({
      conversationId,
      deletedAt: null,
      createdAt: {
        $gte: startMessage.createdAt,
        $lte: endMessage.createdAt,
      },
    })
      .sort({ createdAt: 1 })
      .limit(MAX_BATCH_MESSAGES)
      .populate("senderId", "displayName");
  }

  // Mode cũ: lấy N tin gần nhất tính từ endMessage
  const limit = Math.min(Math.max(Number(maxMessages) || 30, 1), MAX_BATCH_MESSAGES);
  return Message.find({
    conversationId,
    deletedAt: null,
    createdAt: { $lte: endMessage.createdAt },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("senderId", "displayName");
}

// Fetches recent text messages sent by the viewer to use as writing style reference
async function getViewerStyleMessages(conversationId, viewerUserId, styleLimit = STYLE_SAMPLE_COUNT) {
  const viewerId = new mongoose.Types.ObjectId(viewerUserId);

  return Message.find({
    conversationId,
    senderId: viewerId,
    type: "text",
    deletedAt: null,
    text: { $nin: ["", null] },
  })
    .sort({ createdAt: -1 })
    .limit(styleLimit)
    .select("text createdAt");
}

// Clips and censors a single style-sample message text
function sanitizeStyleSample(text) {
  const clipped = clipText(text, 120);
  if (!clipped) return "";
  return containsBadWords(clipped) ? censorText(clipped) : clipped;
}

// Formats viewer's past messages into a numbered list for AI style context
function formatStyleSamples(messages) {
  const samples = messages
    .map((message) => sanitizeStyleSample(message.text))
    .filter(Boolean)
    .reverse();

  if (!samples.length) return "(no prior text messages from viewer in this chat)";

  return samples.map((line, index) => `${index + 1}. ${line}`).join("\n");
}

// Censors an AI-generated reply and returns null if it still contains bad words
function sanitizeAiReply(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;

  const censored = censorText(trimmed);
  return isCleanText(censored) ? censored : null;
}

// Sanitizes AI replies, deduplicates them, and pads with fallbacks to ensure 3 results
function buildSafeReplies(rawReplies) {
  const cleaned = rawReplies
    .map((item) => sanitizeAiReply(item))
    .filter(Boolean);

  const unique = [...new Set(cleaned)];
  for (const fallback of SAFE_REPLY_FALLBACKS) {
    if (unique.length >= 3) break;
    if (!unique.includes(fallback)) unique.push(fallback);
  }

  return unique.slice(0, 3);
}

// Summarizes a batch of messages into 2-5 bullet points using Gemini AI
export async function summarizeMessageBatch(viewerUserId, conversationId, { endMessageId, maxMessages = 30, startMessageId }) {
  await assertParticipant(conversationId, viewerUserId);

  const batch = await getMessagesBatch(conversationId, endMessageId, maxMessages, startMessageId);
  const transcript = formatTranscript(batch, viewerUserId);

  const data = await generateGeminiJson({
    system: [
      "You summarize a chat transcript for the reader.",
      "Reply with JSON only: { \"bullets\": string[] }.",
      "Use 2-5 short bullets.",
      "CRITICAL: Detect the language used in the chat transcript and write ALL bullets in that exact same language. If the chat is in Vietnamese, write in Vietnamese. If in English, write in English. Never switch to another language.",
      "Do not invent facts that are not in the transcript.",
      "If the messages discuss something sensitive (personal information, illegal activity, pornography, or anything against the law), describe it in general terms without revealing specifics.",
      "IMPORTANT: The transcript uses 'Bạn' as the fixed label for the viewer (the person reading this summary). Always refer to the viewer as 'Bạn' in your bullets. Do NOT rephrase 'Bạn' as 'người nói', 'người dùng', 'bạn bè', or any other term. Keep 'Bạn' exactly as written.",
    ].join(" "),
    user: `Transcript:\n${transcript}`,
  });

  const bullets = Array.isArray(data.bullets)
    ? data.bullets.filter((item) => typeof item === "string" && item.trim())
    : [];

  if (!bullets.length) {
    throw new AppError("AI returned an empty summary", 500);
  }

  return {
    bullets,
    meta: { endMessageId, messageCount: batch.length },
  };
}

// Suggests 3 context-aware reply options that match the viewer's writing style using Gemini AI
export async function suggestRepliesForMessageBatch(
  viewerUserId,
  conversationId,
  { endMessageId, maxMessages = 30, startMessageId },
) {
  await assertParticipant(conversationId, viewerUserId);

  const batch = await getMessagesBatch(conversationId, endMessageId, maxMessages, startMessageId);
  const styleMessages = await getViewerStyleMessages(conversationId, viewerUserId, STYLE_SAMPLE_COUNT);
  const transcript = formatTranscript(batch, viewerUserId);
  const styleSamples = formatStyleSamples(styleMessages);

  const data = await generateGeminiJson({
    system: [
      "You suggest reply options for a chat app user.",
      "Reply with JSON only: { \"replies\": [string, string, string] }.",
      "Exactly 3 short, natural replies.",
      "Read the viewer's past messages in THIS conversation to learn how they usually write",
      "(language, length, slang, emoji, punctuation, formality, form of address).",
      "Each suggestion must sound like the viewer typed it, while answering the unread context.",
      "Keep replies polite and clean: no profanity, slurs, hate, or sexual content.",
      "Do not invent facts outside the context.",
    ].join(" "),
    user: [
      "Unread messages to reply to:",
      transcript,
      "",
      `Viewer's last ${styleMessages.length} messages in this chat (writing style reference):`,
      styleSamples,
    ].join("\n"),
  });

  const rawReplies = Array.isArray(data.replies)
    ? data.replies.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
    : [];

  const replies = buildSafeReplies(rawReplies);

  return {
    replies,
    meta: {
      endMessageId,
      messageCount: batch.length,
      styleSampleCount: styleMessages.length,
    },
  };
}
