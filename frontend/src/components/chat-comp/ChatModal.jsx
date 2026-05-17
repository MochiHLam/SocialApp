import { useEffect } from "react";

function ModalCloseButton({ onClose, ariaLabel = "Close" }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="flex h-7 w-7 items-center justify-center rounded-full text-[#65676b] transition hover:bg-[#f0f2f5]"
      aria-label={ariaLabel}
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

export default function ChatModal({
  isOpen = true,
  title,
  titleId,
  onClose,
  children,
  footer,
  maxWidthClassName = "max-w-sm",
  panelClassName = "",
  bodyClassName = "px-6 py-5",
}) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`flex max-h-[min(85vh,640px)] w-full flex-col rounded-2xl bg-white shadow-xl ${maxWidthClassName} ${panelClassName}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {title && (
          <div className="flex shrink-0 items-center justify-between border-b border-[#f0f2f5] px-6 py-4">
            <h2 id={titleId} className="text-base font-bold text-[#1c1e21]">
              {title}
            </h2>
            <ModalCloseButton onClose={onClose} />
          </div>
        )}

        <div className={`min-h-0 flex-1 overflow-y-auto ${bodyClassName}`}>{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-[#f0f2f5] px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}

export { ModalCloseButton };

