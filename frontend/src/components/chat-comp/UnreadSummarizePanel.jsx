import ChatModal from "./ChatModal.jsx";

const OPTION_LABELS = ["A", "B", "C"];

export default function UnreadSummarizePanel({
  isOpen = false,
  unreadCount = 0,
  isLoadingSummary = false,
  summaryBullets = [],
  isLoadingSuggestions = false,
  suggestions = [],
  showSuggestions = false,
  onClose,
  onSuggestResponses,
  onSelectSuggestion,
}) {
  const title =
    unreadCount > 0
      ? `Summarize ${unreadCount} unread messages`
      : "Summarize unread messages";

  return (
    <ChatModal
      isOpen={isOpen}
      title={title}
      titleId="unread-summarize-title"
      onClose={onClose}
      footer={(
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg border border-[#e4e6eb] py-2 text-sm font-semibold text-[#65676b] transition hover:bg-[#f0f2f5]"
        >
          Close
        </button>
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">AI summary</p>

      <div className="mt-3 min-h-[72px] text-sm text-[#1c1e21]">
        {isLoadingSummary ? (
          <p className="text-[#65676b]">Summarizing unread messages…</p>
        ) : (
          <ul className="list-disc space-y-2 pl-4 text-[13px] leading-relaxed text-[#3b3f44]">
            {summaryBullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        )}
      </div>

      {!isLoadingSummary && (
        <div className="mt-5 border-t border-[#f0f2f5] pt-5">
          {!showSuggestions ? (
            <button
              type="button"
              onClick={onSuggestResponses}
              disabled={isLoadingSuggestions}
              className="w-full rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              Suggest response
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#65676b]">
                Pick a reply
              </p>
              {isLoadingSuggestions ? (
                <p className="text-sm text-[#65676b]">Generating suggestions…</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {suggestions.map((reply, index) => (
                    <button
                      key={OPTION_LABELS[index]}
                      type="button"
                      onClick={() => onSelectSuggestion?.(reply)}
                      className="flex w-full items-start gap-2.5 rounded-lg border border-[#e4e6eb] bg-[#f7f8fa] px-3 py-2.5 text-left text-sm text-[#1c1e21] transition hover:border-indigo-300 hover:bg-indigo-50"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                        {OPTION_LABELS[index]}
                      </span>
                      <span className="min-w-0 flex-1 break-words">{reply}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </ChatModal>
  );
}
