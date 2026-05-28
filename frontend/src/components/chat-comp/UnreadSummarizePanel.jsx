import ChatModal from "./ChatModal.jsx";

const OPTION_LABELS = ["A", "B", "C"];

function SummarySkeleton({ lines = 4 }) {
  return (
    <ul className="space-y-2.5" aria-hidden>
      {Array.from({ length: lines }, (_, index) => (
        <li key={index} className="h-14 animate-pulse rounded-lg bg-blue-50" />
      ))}
    </ul>
  );
}

export default function SummarizePanel({
  isOpen = false,
  isFromMessageMode = false,
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
  const title = isFromMessageMode ? "Summary from here" : "Unread summary";
  const subtitle = isFromMessageMode
    ? "From selected message to latest"
    : unreadCount > 0
      ? `${unreadCount} unread messages`
      : "Unread thread recap";

  return (
    <ChatModal
      isOpen={isOpen}
      title={title}
      titleId="unread-summarize-title"
      onClose={onClose}
      maxWidthClassName="max-w-2xl"
      maxHeightClassName="max-h-[min(90vh,780px)]"
      panelClassName="shadow-xl ring-1 ring-black/5"
      bodyClassName="px-6 py-5"
      footer={(
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg border border-[#e4e6eb] py-2.5 text-sm font-semibold text-[#65676b] transition hover:bg-[#f0f2f5]"
        >
          Close
        </button>
      )}
    >
      <p className="mb-5 text-sm text-blue-600">{subtitle}</p>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#65676b]">
          Summary
        </h3>

        <div className="min-h-[140px] rounded-xl border border-blue-100 bg-blue-50/40 p-4">
          {isLoadingSummary ? (
            <div className="space-y-3">
              <p className="text-sm text-blue-600">Summarizing unread messages…</p>
              <SummarySkeleton />
            </div>
          ) : (
            <ul className="space-y-2">
              {summaryBullets.map((bullet, index) => (
                <li
                  key={`${index}-${bullet.slice(0, 24)}`}
                  className="flex gap-3 rounded-lg border border-[#e4e6eb] bg-white px-3.5 py-3"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[11px] font-bold text-white">
                    {index + 1}
                  </span>
                  <p className="min-w-0 flex-1 text-[15px] leading-relaxed text-[#1c1e21]">{bullet}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {!isLoadingSummary && (
        <section className="mt-6 border-t border-[#f0f2f5] pt-6">
          {!showSuggestions ? (
            <button
              type="button"
              onClick={onSuggestResponses}
              disabled={isLoadingSuggestions}
              className="w-full rounded-lg bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              Suggest response
            </button>
          ) : (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[#65676b]">
                Pick a reply
              </h3>

              {isLoadingSuggestions ? (
                <div className="space-y-3">
                  <p className="text-sm text-blue-600">Generating suggestions…</p>
                  <SummarySkeleton lines={3} />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {suggestions.map((reply, index) => (
                    <button
                      key={OPTION_LABELS[index]}
                      type="button"
                      onClick={() => onSelectSuggestion?.(reply)}
                      className="flex w-full items-start gap-3 rounded-lg border border-[#e4e6eb] bg-white px-3.5 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50/50"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
                        {OPTION_LABELS[index]}
                      </span>
                      <span className="min-w-0 flex-1 pt-0.5 text-[15px] leading-relaxed text-[#1c1e21]">
                        {reply}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </ChatModal>
  );
}
