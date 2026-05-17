import { useEffect, useState } from "react";
import { buildMockUnreadSummary, delay } from "../lib/chatAiMock.js";
import {
  MOCK_SUGGESTIONS_DELAY_MS,
  MOCK_SUMMARY_DELAY_MS,
} from "../lib/chatConstants.js";

export function useUnreadSummarize({ messages, threadId, onApplySuggestedReply }) {
  const [unreadUiDismissed, setUnreadUiDismissed] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryBullets, setSummaryBullets] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  useEffect(() => {
    setUnreadUiDismissed(false);
    setIsOpen(false);
    setIsLoadingSummary(false);
    setSummaryBullets([]);
    setSuggestions([]);
    setShowSuggestions(false);
    setIsLoadingSuggestions(false);
  }, [threadId]);

  const close = () => {
    setIsOpen(false);
    setShowSuggestions(false);
    setIsLoadingSuggestions(false);
  };

  const open = async (markers) => {
    setIsOpen(true);
    setIsLoadingSummary(true);
    setShowSuggestions(false);
    setSummaryBullets([]);
    setSuggestions([]);

    await delay(MOCK_SUMMARY_DELAY_MS);

    const mock = buildMockUnreadSummary(messages, markers);
    setSummaryBullets(mock.bullets);
    setSuggestions(mock.replies);
    setIsLoadingSummary(false);
  };

  const suggestResponses = async () => {
    setShowSuggestions(true);
    setIsLoadingSuggestions(true);
    await delay(MOCK_SUGGESTIONS_DELAY_MS);
    setIsLoadingSuggestions(false);
  };

  const selectSuggestion = (reply) => {
    onApplySuggestedReply?.(reply);
    setUnreadUiDismissed(true);
    close();
  };

  return {
    unreadUiDismissed,
    isOpen,
    isLoadingSummary,
    summaryBullets,
    suggestions,
    showSuggestions,
    isLoadingSuggestions,
    open,
    close,
    suggestResponses,
    selectSuggestion,
  };
}
