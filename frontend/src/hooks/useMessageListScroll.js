import { useEffect, useRef } from "react";

export function useMessageListScroll({ messages, isLoadingOlder, onLoadOlderMessages, hasOlderMessages }) {
  const listRef = useRef(null);
  const olderScrollPositionRef = useRef(null);
  const lastMessageId = messages[messages.length - 1]?._id || "";

  useEffect(() => {
    if (!listRef.current || olderScrollPositionRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [lastMessageId]);

  useEffect(() => {
    const listElement = listRef.current;
    const previousPosition = olderScrollPositionRef.current;
    if (!listElement || !previousPosition || isLoadingOlder) return;

    listElement.scrollTop =
      listElement.scrollHeight - previousPosition.scrollHeight + previousPosition.scrollTop;
    olderScrollPositionRef.current = null;
  }, [isLoadingOlder, messages.length]);

  const handleScroll = () => {
    const listElement = listRef.current;
    if (!listElement || !hasOlderMessages || isLoadingOlder || !onLoadOlderMessages) return;
    if (listElement.scrollTop > 80) return;

    olderScrollPositionRef.current = {
      scrollHeight: listElement.scrollHeight,
      scrollTop: listElement.scrollTop,
    };
    onLoadOlderMessages();
  };

  return { listRef, handleScroll };
}
