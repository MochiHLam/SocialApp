import { useRef } from "react";
import { UNREAD_SUMMARIZE_THRESHOLD } from "../lib/chatConstants.js";

export function useFrozenUnreadMarkers({ messages, initialUnreadCount, threadId, unreadUiDismissed }) {
  const frozenMarkersRef = useRef(null);
  const frozenThreadIdRef = useRef(null);

  if (threadId !== frozenThreadIdRef.current) {
    frozenThreadIdRef.current = threadId;
    frozenMarkersRef.current = null;
  }

  const shouldShowMarkers = initialUnreadCount > UNREAD_SUMMARIZE_THRESHOLD;
  if (shouldShowMarkers && !frozenMarkersRef.current && messages.length >= initialUnreadCount) {
    const startIdx = Math.max(0, messages.length - initialUnreadCount);
    frozenMarkersRef.current = {
      firstId: messages[startIdx]?._id,
      lastId: messages[messages.length - 1]?._id,
      count: initialUnreadCount,
    };
  }

  const markers = frozenMarkersRef.current;
  const showUnreadUi = markers && !unreadUiDismissed;

  return { markers, showUnreadUi };
}
