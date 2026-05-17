function formatCallDuration(totalSeconds = 0) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function getCallMessageLabel(message, isMine) {
  const modeLabel = message.call?.mode === "video" ? "Video call" : "Voice call";
  const status = message.call?.status || "ended";

  if (status === "cancelled") return isMine ? "You cancelled the call" : "Call cancelled";
  if (status === "declined") return isMine ? "You declined the call" : "Call declined";
  if (status === "missed") return isMine ? "No answer" : "Missed call";

  const duration = formatCallDuration(message.call?.durationSeconds);
  return message.call?.durationSeconds ? `${modeLabel} · ${duration}` : modeLabel;
}

export default function CallMessageBubble({ message, isMine }) {
  const status = message.call?.status || "ended";
  const isFailedCall = ["cancelled", "declined", "missed"].includes(status);

  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isFailedCall
            ? isMine ? "bg-white/20 text-white" : "bg-red-100 text-red-500"
            : isMine ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-600"
        }`}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.06 2.18 2 2 0 0 1 4.05 0h3a2 2 0 0 1 2 1.72c.13.95.35 1.88.66 2.76a2 2 0 0 1-.45 2.11L8 7.85a16 16 0 0 0 6 6l1.26-1.26a2 2 0 0 1 2.11-.45c.88.31 1.81.53 2.76.66A2 2 0 0 1 22 14.8v2.12z" transform="translate(0 1)" />
        </svg>
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{getCallMessageLabel(message, isMine)}</p>
        <p className={`text-[11px] ${isMine ? "text-white/75" : "text-[#65676b]"}`}>
          {message.call?.mode === "video" ? "Video" : "Audio"}
        </p>
      </div>
    </div>
  );
}
