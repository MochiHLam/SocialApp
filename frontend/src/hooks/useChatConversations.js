import { useEffect, useRef, useState } from "react";
import {
  createGroupConversation,
  getChatConversations,
  hideChatConversation,
} from "../lib/api.js";
import { getConversationSortTime } from "../lib/chatConversationUtils.js";
import { CHAT_SOCKET_EVENTS, PRESENCE_SOCKET_EVENTS, getAuthenticatedSocket } from "../lib/socket.js";

export function useChatConversations({ selectedChatId, onSelectChat }) {
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function loadConversations({ silent = false } = {}) {
      if (!hasLoadedOnceRef.current) setIsLoading(true);
      if (!silent) setError("");

      try {
        const data = await getChatConversations();
        const nextConversations = data?.conversations || [];
        if (!isMounted) return;

        setConversations(nextConversations);
        hasLoadedOnceRef.current = true;

        if (selectedChatId) {
          const matched = nextConversations.find((item) => item.id === selectedChatId);
          if (matched) onSelectChat(matched, false);
        } else if (nextConversations.length > 0) {
          onSelectChat(nextConversations[0], false);
        }
      } catch (err) {
        if (isMounted && !silent) setError(err.message || "Failed to load conversations");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadConversations();
    return () => {
      isMounted = false;
    };
  }, [onSelectChat, selectedChatId]);

  useEffect(() => {
    const socket = getAuthenticatedSocket();
    if (!socket) return undefined;

    const applyConversationUpdate = (conversation) => {
      if (!conversation?.id) return false;

      setConversations((prev) => {
        const index = prev.findIndex((item) => item.id === conversation.id);
        if (index === -1) return [conversation, ...prev];

        const next = [...prev];
        next[index] = { ...next[index], ...conversation };
        return next.sort((a, b) => getConversationSortTime(b) - getConversationSortTime(a));
      });

      if (selectedChatId === conversation.id) onSelectChat(conversation, false);
      return true;
    };

    const handleChatEvent = (payload) => {
      if (!applyConversationUpdate(payload?.conversation)) {
        getChatConversations()
          .then((data) => setConversations(data?.conversations || []))
          .catch(() => {});
      }
    };

    const handleConversationRemoved = (payload) => {
      if (!payload?.conversationId) return;

      setConversations((prev) => {
        const next = prev.filter((conversation) => conversation.id !== payload.conversationId);
        if (selectedChatId === payload.conversationId) onSelectChat(next[0] || null, true);
        return next;
      });
    };

    CHAT_SOCKET_EVENTS.forEach((eventName) => socket.on(eventName, handleChatEvent));
    socket.on("chat:conversation_removed", handleConversationRemoved);
    return () => {
      CHAT_SOCKET_EVENTS.forEach((eventName) => socket.off(eventName, handleChatEvent));
      socket.off("chat:conversation_removed", handleConversationRemoved);
    };
  }, [onSelectChat, selectedChatId]);

  useEffect(() => {
    if (!selectedChatId) return;
    setConversations((prev) => prev.map((item) => (
      item.id === selectedChatId ? { ...item, unread: 0 } : item
    )));
  }, [selectedChatId]);

  useEffect(() => {
    const socket = getAuthenticatedSocket();
    if (!socket) return undefined;

    const handlePresenceChanged = (payload) => {
      if (!payload?.userId) return;

      setConversations((prev) => prev.map((conversation) => {
        if (String(conversation.friendId) !== String(payload.userId)) return conversation;

        const nextConversation = {
          ...conversation,
          presenceStatus: payload.status || "offline",
          lastActiveAt: payload.lastActiveAt || conversation.lastActiveAt || null,
        };

        if (selectedChatId === conversation.id) onSelectChat(nextConversation, false);
        return nextConversation;
      }));
    };

    PRESENCE_SOCKET_EVENTS.forEach((eventName) => socket.on(eventName, handlePresenceChanged));
    return () => {
      PRESENCE_SOCKET_EVENTS.forEach((eventName) => socket.off(eventName, handlePresenceChanged));
    };
  }, [onSelectChat, selectedChatId]);

  const hideConversation = async (chat) => {
    await hideChatConversation({ conversationId: chat.id });
    setConversations((prev) => {
      const next = prev.filter((item) => item.id !== chat.id);
      if (selectedChatId === chat.id) onSelectChat(next[0] || null, false);
      return next;
    });
  };

  const createGroup = async ({ name, avatar }) => {
    const data = await createGroupConversation({ name, avatar });
    const conversation = data?.conversation;
    if (!conversation?.id) throw new Error("Group conversation not available");

    setConversations((prev) => [conversation, ...prev.filter((item) => item.id !== conversation.id)]);
    onSelectChat(conversation);
    return conversation;
  };

  return {
    conversations,
    isLoading,
    error,
    hideConversation,
    createGroup,
  };
}
