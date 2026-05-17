import { useEffect, useRef, useState } from "react";
import {
  deleteChatMessage,
  getChatMessages,
  markChatConversationRead,
  sendChatImage,
  sendChatMessage,
} from "../lib/api.js";
import { MESSAGE_PAGE_LIMIT } from "../lib/chatConstants.js";
import {
  appendMessageOnce,
  getDeletedMessagePatch,
  mergeOlderMessages,
} from "../lib/chatMessageUtils.js";
import { getAuthenticatedSocket } from "../lib/socket.js";

export function useChatMessages({
  activeThreadId,
  activeThreadCacheKey,
  selectedChat,
  currentUserId,
  onClearRemoteTypingUser,
}) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [olderCursor, setOlderCursor] = useState(null);
  const [error, setError] = useState("");
  const messageCacheRef = useRef(new Map());
  const pageInfoCacheRef = useRef(new Map());
  const previousThreadIdRef = useRef(null);
  const initialUnreadCountRef = useRef(0);

  const applyPageInfo = (cacheKey, nextHasOlderMessages, nextOlderCursor) => {
    setHasOlderMessages(nextHasOlderMessages);
    setOlderCursor(nextOlderCursor);
    pageInfoCacheRef.current.set(cacheKey, {
      hasOlderMessages: nextHasOlderMessages,
      olderCursor: nextOlderCursor,
    });
  };

  const applyMessagesForThread = (cacheKey, nextMessages) => {
    setMessages(nextMessages);
    messageCacheRef.current.set(cacheKey, nextMessages);
  };

  const updateMessagesForActiveThread = (updater) => {
    setMessages((prevMessages) => {
      const nextMessages = updater(prevMessages);
      if (activeThreadCacheKey) {
        messageCacheRef.current.set(activeThreadCacheKey, nextMessages);
      }
      return nextMessages;
    });
  };

  useEffect(() => {
    let isMounted = true;

    async function loadMessages() {
      if (!activeThreadId) {
        previousThreadIdRef.current = null;
        setMessages([]);
        setHasOlderMessages(false);
        setOlderCursor(null);
        setError("");
        return;
      }

      const isThreadChange = previousThreadIdRef.current !== activeThreadId;
      if (isThreadChange) {
        initialUnreadCountRef.current = selectedChat?.unread ?? 0;
      }

      const cachedMessages = messageCacheRef.current.get(activeThreadCacheKey);
      const cachedPageInfo = pageInfoCacheRef.current.get(activeThreadCacheKey);

      if (cachedMessages) {
        setMessages(cachedMessages);
        setHasOlderMessages(Boolean(cachedPageInfo?.hasOlderMessages));
        setOlderCursor(cachedPageInfo?.olderCursor || null);
        setIsLoading(false);
      } else if (isThreadChange) {
        setMessages([]);
        setHasOlderMessages(false);
        setOlderCursor(null);
        setIsLoading(true);
      } else {
        setIsLoading(false);
      }

      previousThreadIdRef.current = activeThreadId;
      setError("");

      try {
        const data = await getChatMessages({
          conversationId: activeThreadId,
          limit: MESSAGE_PAGE_LIMIT,
        });
        if (!isMounted) return;

        applyMessagesForThread(activeThreadCacheKey, data?.messages || []);
        applyPageInfo(
          activeThreadCacheKey,
          Boolean(data?.pageInfo?.hasMore),
          data?.pageInfo?.nextBefore || null,
        );
      } catch (err) {
        if (isMounted) setError(err.message || "Failed to load messages");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadMessages();
    return () => {
      isMounted = false;
    };
  }, [activeThreadId, activeThreadCacheKey]);

  const handleLoadOlderMessages = async () => {
    if (!activeThreadId || !olderCursor || isLoadingOlder) return;

    setIsLoadingOlder(true);
    setError("");

    try {
      const data = await getChatMessages({
        conversationId: activeThreadId,
        limit: MESSAGE_PAGE_LIMIT,
        before: olderCursor,
      });

      updateMessagesForActiveThread((prevMessages) => (
        mergeOlderMessages(prevMessages, data?.messages || [])
      ));
      applyPageInfo(
        activeThreadCacheKey,
        Boolean(data?.pageInfo?.hasMore),
        data?.pageInfo?.nextBefore || null,
      );
    } catch (err) {
      setError(err.message || "Failed to load older messages");
    } finally {
      setIsLoadingOlder(false);
    }
  };

  useEffect(() => {
    if (!activeThreadId) return undefined;

    const socket = getAuthenticatedSocket();
    if (!socket) return undefined;

    const handleMessageCreated = (payload) => {
      if (payload?.conversationId !== activeThreadId || !payload?.message) return;

      updateMessagesForActiveThread((prevMessages) => (
        appendMessageOnce(prevMessages, payload.message)
      ));
      onClearRemoteTypingUser?.(String(payload.message.senderId));

      if (payload.message.senderId !== currentUserId) {
        markChatConversationRead({ conversationId: activeThreadId }).catch(() => {});
      }
    };

    const handleMessageDeleted = (payload) => {
      if (payload?.conversationId !== activeThreadId || !payload?.message) return;

      updateMessagesForActiveThread((prevMessages) => (
        prevMessages.map((message) => (
          message._id === payload.message._id ? payload.message : message
        ))
      ));
    };

    socket.on("chat:message_created", handleMessageCreated);
    socket.on("chat:message_deleted", handleMessageDeleted);

    return () => {
      socket.off("chat:message_created", handleMessageCreated);
      socket.off("chat:message_deleted", handleMessageDeleted);
    };
  }, [activeThreadId, activeThreadCacheKey, currentUserId, onClearRemoteTypingUser]);

  const handleSendMessage = async (text) => {
    if (!activeThreadId) return;

    const data = await sendChatMessage({ conversationId: activeThreadId, text });
    if (data?.message) {
      updateMessagesForActiveThread((prevMessages) => appendMessageOnce(prevMessages, data.message));
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!activeThreadId) return;

    await deleteChatMessage({ messageId });
    updateMessagesForActiveThread((prevMessages) => (
      prevMessages.map(getDeletedMessagePatch(messageId))
    ));
  };

  const handleAttachImage = async (file) => {
    if (!activeThreadId) return;

    const data = await sendChatImage({ conversationId: activeThreadId, file });
    if (data?.message) {
      updateMessagesForActiveThread((prevMessages) => appendMessageOnce(prevMessages, data.message));
    }
  };

  return {
    messages,
    isLoading,
    isLoadingOlder,
    hasOlderMessages,
    error,
    initialUnreadCount: initialUnreadCountRef.current,
    handleLoadOlderMessages,
    handleSendMessage,
    handleDeleteMessage,
    handleAttachImage,
  };
}
