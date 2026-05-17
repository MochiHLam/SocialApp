export function UnreadCountBanner({ count }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="h-px flex-1 bg-amber-300" />
      <span className="shrink-0 rounded-full bg-amber-50 px-3 py-0.5 text-[11px] font-semibold text-amber-600">
        There are {count} unread messages
      </span>
      <div className="h-px flex-1 bg-amber-300" />
    </div>
  );
}

export function SummarizeUnreadButton({ onClick }) {
  return (
    <div className="flex items-center gap-2 py-2">
      <div className="h-px flex-1 bg-indigo-200" />
      <button
        type="button"
        className="shrink-0 rounded-full border border-indigo-300 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-600 transition hover:bg-indigo-100 active:scale-95"
        onClick={onClick}
      >
        ✦ Summarize unread messages
      </button>
      <div className="h-px flex-1 bg-indigo-200" />
    </div>
  );
}
