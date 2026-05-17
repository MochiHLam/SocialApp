import { useEffect, useRef, useState } from "react";
import { REMOTE_TYPING_TTL_MS, TYPING_IDLE_MS } from "../lib/chatConstants.js";
import { emitChatTyping, getAuthenticatedSocket } from "../lib/socket.js";

export function useChatTyping({ activeThreadId, currentUserId, selectedChat }) {
  const typingStopTimerRef = useRef(null);
  const isTypingRef = useRef(false);
  const typingConversationIdRef = useRef(null);
  const remoteTypingTimersRef = useRef(new Map());
  const [typingUserIds, setTypingUserIds] = useState([]);

  const stopLocalTyping = () => {
    window.clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = null;

    const typingConversationId = typingConversationIdRef.current;
    if (!isTypingRef.current || !typingConversationId) return;
    isTypingRef.current = false;
    typingConversationIdRef.current = null;
    emitChatTyping({ conversationId: typingConversationId, isTyping: false });
  };

  const handleTypingChange = (isTyping) => {
    if (!activeThreadId) return;

    window.clearTimeout(typingStopTimerRef.current);

    if (!isTyping) {
      stopLocalTyping();
      return;
    }

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      typingConversationIdRef.current = activeThreadId;
      emitChatTyping({ conversationId: activeThreadId, isTyping: true });
    }

    typingStopTimerRef.current = window.setTimeout(stopLocalTyping, TYPING_IDLE_MS);
  };

  const clearRemoteTypingUser = (userId) => {
    window.clearTimeout(remoteTypingTimersRef.current.get(userId));
    remoteTypingTimersRef.current.delete(userId);
    setTypingUserIds((prevUserIds) => prevUserIds.filter((id) => id !== userId));
  };

  useEffect(() => {
    stopLocalTyping();
    setTypingUserIds([]);
    remoteTypingTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    remoteTypingTimersRef.current.clear();
  }, [activeThreadId]);

  useEffect(() => {
    if (!activeThreadId) return undefined;

    const socket = getAuthenticatedSocket();
    if (!socket) return undefined;

    const handleTyping = (payload) => {
      if (payload?.conversationId !== activeThreadId) return;
      if (!payload?.userId || String(payload.userId) === String(currentUserId)) return;

      const userId = String(payload.userId);
      if (!payload.isTyping) {
        clearRemoteTypingUser(userId);
        return;
      }

      setTypingUserIds((prevUserIds) => (
        prevUserIds.includes(userId) ? prevUserIds : [...prevUserIds, userId]
      ));

      window.clearTimeout(remoteTypingTimersRef.current.get(userId));
      const timerId = window.setTimeout(() => {
        clearRemoteTypingUser(userId);
      }, REMOTE_TYPING_TTL_MS);
      remoteTypingTimersRef.current.set(userId, timerId);
    };

    socket.on("chat:typing", handleTyping);
    return () => {
      socket.off("chat:typing", handleTyping);
    };
  }, [activeThreadId, currentUserId]);

  useEffect(() => () => {
    stopLocalTyping();
    remoteTypingTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    remoteTypingTimersRef.current.clear();
  }, []);

  const typingNames = typingUserIds
    .map((typingUserId) => {
      if (String(selectedChat?.friendId) === String(typingUserId)) return selectedChat?.name;
      return selectedChat?.participants?.find(
        (participant) => String(participant.id) === String(typingUserId),
      )?.displayName;
    })
    .filter(Boolean);

  const typingLabel = typingNames.length === 0
    ? ""
    : typingNames.length === 1
      ? `${typingNames[0]} is typing...`
      : "Several people are typing...";

  return {
    typingLabel,
    handleTypingChange,
    stopLocalTyping,
    clearRemoteTypingUser,
  };
}
