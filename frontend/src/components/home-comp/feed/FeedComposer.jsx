import FeedAvatar from "./FeedAvatar.jsx";

export default function FeedComposer({
  displayName,
  user,
  onAvatarClick,
  composerText,
  onComposerTextChange,
  onComposerKeyDown,
  composerImageUrl,
  onAttachImage,
  composerFileInputRef,
  onCreatePost,
  isPosting,
  canPost,
}) {
  return (
    <section className="rounded-lg border border-[#e4e6eb] bg-white p-4 shadow-[0_2px_4px_rgba(0,0,0,0.08),0_8px_16px_rgba(0,0,0,0.06)]">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onAvatarClick}
          className="rounded-full focus:outline-none"
          aria-label="Go to your profile"
        >
          <FeedAvatar user={user} displayName={displayName} />
        </button>
        <div className="min-w-0 flex-1">
          <label htmlFor="home-composer" className="sr-only">
            Create a post
          </label>
          <textarea
            id="home-composer"
            rows={2}
            value={composerText}
            onChange={(event) => onComposerTextChange(event.target.value)}
            onKeyDown={onComposerKeyDown}
            placeholder={`${displayName}, what's on your mind?`}
            className="w-full resize-none rounded-xl border border-[#e4e6eb] bg-[#f0f2f5] px-4 py-3 text-sm text-[#1c1e21] outline-none placeholder:text-[#8a8d91]"
          />
          {composerImageUrl && (
            <div className="mt-2 overflow-hidden rounded-lg border border-[#e4e6eb] bg-[#f0f2f5]">
              <img
                src={composerImageUrl}
                alt="Post attachment preview"
                className="max-h-60 w-full object-contain"
              />
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#f0f2f5] pt-3">
            <div className="flex flex-wrap gap-2">
              <input
                ref={composerFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onAttachImage}
              />
              <button
                type="button"
                onClick={() => composerFileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#f0f2f5] px-4 py-1.5 text-xs font-semibold text-[#65676b] transition-colors hover:bg-[#e4e6eb]"
              >
                <svg
                  className="h-4 w-4 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                  />
                </svg>
                Attach image
              </button>
            </div>
            <button
              type="button"
              onClick={onCreatePost}
              disabled={!canPost || isPosting}
              className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {isPosting ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
