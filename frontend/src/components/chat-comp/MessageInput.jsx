import { useEffect, useRef, useState } from "react";

const MAX_TEXTAREA_ROWS = 5;

export default function MessageInput({
  onSend,
  onAttachImage,
  onTypingChange,
  prefillKey = 0,
  prefillText = "",
}) {
  const [text, setText] = useState("");
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const attachMenuRef = useRef(null);

  useEffect(() => {
    if (!prefillKey) return;
    setText(prefillText);
    onTypingChange?.(prefillText.trim().length > 0);
    textareaRef.current?.focus();
  }, [prefillKey, prefillText]);

  useEffect(() => {
    if (!textareaRef.current) return;

    textareaRef.current.style.height = "auto";
    const lineHeight = 24;
    const maxHeight = lineHeight * MAX_TEXTAREA_ROWS;
    const nextHeight = Math.min(textareaRef.current.scrollHeight, maxHeight);
    textareaRef.current.style.height = `${nextHeight}px`;
    textareaRef.current.style.overflowY =
      textareaRef.current.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [text]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!attachMenuRef.current?.contains(event.target)) {
        setIsAttachMenuOpen(false);
      }
    };

    window.addEventListener("click", handleClickOutside);
    return () => {
      window.removeEventListener("click", handleClickOutside);
    };
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();

    const cleanText = text.trim();
    if (!cleanText) return;

    onTypingChange?.(false);
    onSend(cleanText);
    setText("");
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  const handleAttachClick = () => {
    setIsAttachMenuOpen((prevState) => !prevState);
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    if (onAttachImage) onAttachImage(selectedFile);
    setIsAttachMenuOpen(false);
    event.target.value = "";
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-[#e4e6eb] p-3">
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <div ref={attachMenuRef} className="relative">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleAttachClick();
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white transition hover:bg-blue-600"
            aria-label="Open attachment options"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
          </button>

          {isAttachMenuOpen && (
            <div className="absolute bottom-12 left-0 z-10 min-w-[170px] rounded-md border border-[#e4e6eb] bg-white py-1 shadow-lg">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-3 py-2 text-left text-sm text-[#1c1e21] transition hover:bg-[#f0f2f5]"
              >
                Attach image
              </button>
            </div>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => {
            const nextText = event.target.value;
            setText(nextText);
            onTypingChange?.(nextText.trim().length > 0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="max-h-[120px] min-h-[42px] flex-1 resize-none rounded-2xl border border-[#dadde1] px-4 py-2.5 text-sm leading-6 outline-none transition focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-blue-300"
          aria-label="Send message"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21.999 2.813a1 1 0 00-1.356-.93L2.32 9.21a1 1 0 00.067 1.87l7.207 2.403 2.404 7.206a1 1 0 001.87.067l7.327-18.322a.998.998 0 00-.196-1.093zM11.168 12.83l-5.2-1.734L18.186 6.21l-7.018 6.62zm1.734 5.2l-1.733-5.2 6.62-7.018-4.887 12.218z" />
          </svg>
        </button>
      </div>
    </form>
  );
}
