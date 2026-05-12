import { useEffect, useRef, useState } from "react";
import ChatHeader from "./ChatHeader.jsx";
import MessageList from "./MessageList.jsx";
import MessageInput from "./MessageInput.jsx";
import ChatCallOverlay from "./ChatCallOverlay.jsx";
import {
  deleteChatMessage,
  getChatMessages,
  markChatConversationRead,
  sendChatImage,
  sendChatMessage,
} from "../../lib/api.js";
import { emitChatTyping, getAuthenticatedSocket } from "../../lib/socket.js";

const TYPING_IDLE_MS = 2500;
const REMOTE_TYPING_TTL_MS = 3500;
const MESSAGE_PAGE_LIMIT = 20;

function appendMessageOnce(messages, nextMessage) {
  if (!nextMessage?._id) return messages;
  if (messages.some((message) => message._id === nextMessage._id)) return messages;
  return [...messages, nextMessage];
}

export default function ChatSectionView({ selectedChatThread, onOpenProfile, user }) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [olderCursor, setOlderCursor] = useState(null);
  const [error, setError] = useState("");
  const messageCacheRef = useRef(new Map());
  const pageInfoCacheRef = useRef(new Map());
  const previousThreadIdRef = useRef(null);
  const typingStopTimerRef = useRef(null);
  const isTypingRef = useRef(false);
  const typingConversationIdRef = useRef(null);
  const remoteTypingTimersRef = useRef(new Map());
  const [typingUserIds, setTypingUserIds] = useState([]);

  const selectedChat = selectedChatThread || null;
  const activeThreadId = selectedChat?.id;
  const activeThreadCacheKey = activeThreadId
    ? `${activeThreadId}:${selectedChat?.time || selectedChat?.lastMessageAt || ""}`
    : "";

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

    typingStopTimerRef.current = window.setTimeout(() => {
      stopLocalTyping();
    }, TYPING_IDLE_MS);
  };

  const clearRemoteTypingUser = (userId) => {
    window.clearTimeout(remoteTypingTimersRef.current.get(userId));
    remoteTypingTimersRef.current.delete(userId);
    setTypingUserIds((prevUserIds) => prevUserIds.filter((id) => id !== userId));
  };

  useEffect(() => {
    let isMounted = true;

    async function loadMessages() {
      if (!activeThreadId) {
        previousThreadIdRef.current = null;
        setMessages([]);
        setHasOlderMessages(false);
        setOlderCursor(null);
        setTypingUserIds([]);
        stopLocalTyping();
        return;
      }

      const isThreadChange = previousThreadIdRef.current !== activeThreadId;
      const cachedMessages = messageCacheRef.current.get(activeThreadCacheKey);
      const cachedPageInfo = pageInfoCacheRef.current.get(activeThreadCacheKey);

      if (cachedMessages) {
        setMessages(cachedMessages);
        setHasOlderMessages(Boolean(cachedPageInfo?.hasOlderMessages));
        setOlderCursor(cachedPageInfo?.olderCursor || null);
        setIsLoading(false);
      } else {
        if (isThreadChange) {
          setMessages([]);
          setHasOlderMessages(false);
          setOlderCursor(null);
          setIsLoading(true);
        } else {
          setIsLoading(false);
        }
      }
      previousThreadIdRef.current = activeThreadId;
      setError("");

      try {
        const data = await getChatMessages({
          conversationId: activeThreadId,
          limit: MESSAGE_PAGE_LIMIT,
        });
        if (isMounted) {
          const nextMessages = data?.messages || [];
          const nextHasOlderMessages = Boolean(data?.pageInfo?.hasMore);
          const nextOlderCursor = data?.pageInfo?.nextBefore || null;

          applyMessagesForThread(activeThreadCacheKey, nextMessages);
          applyPageInfo(activeThreadCacheKey, nextHasOlderMessages, nextOlderCursor);
        }
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

  useEffect(() => {
    stopLocalTyping();
    setTypingUserIds([]);
    remoteTypingTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    remoteTypingTimersRef.current.clear();
  }, [activeThreadId]);

  const handleLoadOlderMessages = async () => {
    if (!activeThreadId || !olderCursor || isLoadingOlder) return;

    setIsLoadingOlder(true);

    try {
      const data = await getChatMessages({
        conversationId: activeThreadId,
        limit: MESSAGE_PAGE_LIMIT,
        before: olderCursor,
      });
      const olderMessages = data?.messages || [];

      updateMessagesForActiveThread((prevMessages) => {
        const existingIds = new Set(prevMessages.map((message) => message._id));
        return [
          ...olderMessages.filter((message) => !existingIds.has(message._id)),
          ...prevMessages,
        ];
      });
      const nextHasOlderMessages = Boolean(data?.pageInfo?.hasMore);
      const nextOlderCursor = data?.pageInfo?.nextBefore || null;
      applyPageInfo(activeThreadCacheKey, nextHasOlderMessages, nextOlderCursor);
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

      updateMessagesForActiveThread((prevMessages) => appendMessageOnce(prevMessages, payload.message));
      clearRemoteTypingUser(String(payload.message.senderId));

      if (payload.message.senderId !== user?.id) {
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
  }, [activeThreadId, activeThreadCacheKey, user?.id]);

  useEffect(() => {
    if (!activeThreadId) return undefined;

    const socket = getAuthenticatedSocket();
    if (!socket) return undefined;

    const handleTyping = (payload) => {
      if (payload?.conversationId !== activeThreadId) return;
      if (!payload?.userId || String(payload.userId) === String(user?.id)) return;

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
  }, [activeThreadId, user?.id]);

  useEffect(() => {
    return () => {
      stopLocalTyping();
      remoteTypingTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      remoteTypingTimersRef.current.clear();
    };
  }, []);

  const handleSendMessage = async (text) => {
    if (!activeThreadId) return;

    stopLocalTyping();
    const data = await sendChatMessage({ conversationId: activeThreadId, text });
    if (data?.message) {
      updateMessagesForActiveThread((prevMessages) => appendMessageOnce(prevMessages, data.message));
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!activeThreadId) return;

    await deleteChatMessage({ messageId });
    updateMessagesForActiveThread((prevMessages) => (
      prevMessages.map((message) => (
        message._id === messageId
          ? { ...message, text: "", imageUrl: "", isDeleted: true }
          : message
      ))
    ));
  };

  const handleAttachImage = async (file) => {
    if (!activeThreadId) return;

    stopLocalTyping();
    const data = await sendChatImage({
      conversationId: activeThreadId,
      file,
    });
    if (data?.message) {
      updateMessagesForActiveThread((prevMessages) => appendMessageOnce(prevMessages, data.message));
    }
  };

  const [callState, setCallState] = useState({
    isOpen: false,
    phase: "outgoing_ringing", // outgoing_ringing | incoming_ringing | in_call
    mode: "voice", // voice | video
    peerName: "",
    peerAvatarUrl: "",
    isMicOn: true,
    isCamOn: true,
  });

  useEffect(() => {
    if (!selectedChat) {
      setCallState((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
      return;
    }
    setCallState((prev) => ({
      ...prev,
      peerName: selectedChat.name || "",
      peerAvatarUrl: selectedChat.profilePic || "",
    }));
  }, [selectedChat?.id]);

  const startCall = (mode) => {
    if (!selectedChat || selectedChat.type === "group") return;
    setCallState({
      isOpen: true,
      phase: "outgoing_ringing",
      mode,
      peerName: selectedChat.name || "",
      peerAvatarUrl: selectedChat.profilePic || "",
      isMicOn: true,
      isCamOn: mode === "video",
    });
  };

  const cancelOutgoingCall = () => {
    setCallState((prev) => ({ ...prev, isOpen: false }));
  };

  const acceptIncomingCall = () => {
    setCallState((prev) => ({ ...prev, phase: "in_call", isOpen: true }));
  };

  const debugAcceptOutgoingCall = () => {
    setCallState((prev) => ({ ...prev, phase: "in_call", isOpen: true }));
  };

  const declineIncomingCall = () => {
    setCallState((prev) => ({ ...prev, isOpen: false }));
  };

  const endCall = () => {
    setCallState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleOpenChatProfile = () => {
    if (selectedChat.type === "group") return;
    const friendId = selectedChat.friendId ?? selectedChat.otherUserId;
    if (!friendId) return;
    onOpenProfile?.({
      id: friendId,
      displayName: selectedChat.name,
      avatarUrl: selectedChat.profilePic,
    });
  };

  const typingNames = typingUserIds
    .map((typingUserId) => {
      if (String(selectedChat.friendId) === String(typingUserId)) return selectedChat.name;
      return selectedChat.participants?.find((participant) => String(participant.id) === String(typingUserId))?.displayName;
    })
    .filter(Boolean);

  const typingLabel = typingNames.length === 0
    ? ""
    : typingNames.length === 1
      ? `${typingNames[0]} is typing...`
      : "Several people are typing...";

  if (!selectedChat) {
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

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatHeader
          chat={selectedChat}
          onCall={{
            voice: () => startCall("voice"),
            video: () => startCall("video"),
          }}
          onOpenProfile={handleOpenChatProfile}
          canOpenProfile={selectedChat.type !== "group"}
        />
        <ChatCallOverlay
          isOpen={callState.isOpen}
          phase={callState.phase}
          mode={callState.mode}
          peerName={callState.peerName}
          peerAvatarUrl={callState.peerAvatarUrl}
          isMicOn={callState.isMicOn}
          isCamOn={callState.isCamOn}
          onAccept={acceptIncomingCall}
          onDecline={declineIncomingCall}
          onCancel={cancelOutgoingCall}
          onDebugAcceptOutgoing={debugAcceptOutgoingCall}
          onToggleMic={() => setCallState((prev) => ({ ...prev, isMicOn: !prev.isMicOn }))}
          onToggleCam={() => setCallState((prev) => {
            const nextCamOn = !prev.isCamOn;
            return {
              ...prev,
              isCamOn: nextCamOn,
              // If user starts from voice call and turns camera on, treat it as video-capable UI.
              mode: nextCamOn ? "video" : prev.mode,
            };
          })}
          onEnd={endCall}
        />
        <MessageList
          messages={messages}
          currentUserId={user?.id}
          isGroupChat={selectedChat.type === "group"}
          onDeleteMessage={handleDeleteMessage}
          isLoading={isLoading}
          error={error}
          hasOlderMessages={hasOlderMessages}
          isLoadingOlder={isLoadingOlder}
          onLoadOlderMessages={handleLoadOlderMessages}
        />
        {typingLabel && (
          <div className="border-t border-[#f0f2f5] px-4 py-1.5 text-xs font-medium text-[#65676b]">
            {typingLabel}
          </div>
        )}
        <MessageInput
          onSend={handleSendMessage}
          onAttachImage={handleAttachImage}
          onTypingChange={handleTypingChange}
        />
      </div>
    </section>
  );
}
