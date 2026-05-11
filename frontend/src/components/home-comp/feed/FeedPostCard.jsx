import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

import { formatPostCreatedAtDisplay } from "../../../lib/postDisplayTime.js";

function IconThumbsUp({ className = "h-3.5 w-3.5" }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
      <path d="M7 10v12" />
    </svg>
  );
}

function IconReply({ className = "h-3.5 w-3.5" }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

function commentCreatedAtLabel(raw) {
  if (raw == null) return "";
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return formatPostCreatedAtDisplay(d);
}

function openAuthorProfile(onOpenProfile, authorId, displayName, avatarUrl) {
  if (!onOpenProfile || authorId == null || String(authorId).trim() === "") return;
  const payload = { id: String(authorId) };
  if (displayName) payload.displayName = displayName;
  if (avatarUrl) payload.avatarUrl = avatarUrl;
  onOpenProfile(payload);
}

function CommentMenuPortal({ anchorEl, onClose, children }) {
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    setPos({
      top: rect.bottom + window.scrollY + 4,
      right: window.innerWidth - rect.right - window.scrollX,
    });
  }, [anchorEl]);

  if (!pos) return null;

  return createPortal(
    <>
      {/* backdrop to close on outside click */}
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />
      <div
        style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}
        className="min-w-[130px] rounded-md border border-[#e4e6eb] bg-white py-1 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body
  );
}

function CommentAvatar({ avatarUrl, authorName, sm }) {
  const box = sm ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-xs";
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={authorName}
        className={`${box} shrink-0 rounded-full object-cover ring-1 ring-black/5`}
      />
    );
  }

  const initial = authorName?.[0]?.toUpperCase() || "?";
  return (
    <div
      className={`flex ${box} shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700`}
    >
      {initial}
    </div>
  );
}

export default function FeedPostCard({
  post,
  viewerId,
  onOpenProfile,
  onTogglePostLike,
  onUpdatePost,
  onDeletePost,
  onAddComment,
  onAddReply,
  onUpdateComment,
  onDeleteComment,
  onToggleCommentLike,
}) {
  const MAX_COMMENT_INPUT_ROWS = 3;
  const [isLiked, setIsLiked] = useState(Boolean(post.likedByViewer));
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [isCommentOpen, setIsCommentOpen] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [isPostMenuOpen, setIsPostMenuOpen] = useState(false);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editingPostCaption, setEditingPostCaption] = useState(post.caption || "");
  const [isSavingPost, setIsSavingPost] = useState(false);
  const [openCommentMenuId, setOpenCommentMenuId] = useState(null);
  const [commentMenuAnchor, setCommentMenuAnchor] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [comments, setComments] = useState(() =>
    (post.comments || []).map((c) => ({
      ...c,
      replies: Array.isArray(c.replies) ? [...c.replies] : [],
    }))
  );
  const [replyParentId, setReplyParentId] = useState(null);
  const [replyInput, setReplyInput] = useState("");
  const commentInputRef = useRef(null);

  useEffect(() => {
    setIsLiked(Boolean(post.likedByViewer));
    setLikeCount(post.likeCount || 0);
    if (!isEditingPost) setEditingPostCaption(post.caption || "");
    setComments((post.comments || []).map((c) => ({
      ...c,
      replies: Array.isArray(c.replies) ? [...c.replies] : [],
    })));
  }, [isEditingPost, post.id, post.likedByViewer, post.likeCount, post.caption, post.comments]);

  // parse once; bad values still show the raw string in the line under the name
  const createdAtDate = useMemo(() => {
    const raw = post.createdAt;
    if (raw == null) return null;
    const d = raw instanceof Date ? raw : new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [post.createdAt]);

  const createdAtLabel = useMemo(() => {
    if (!createdAtDate) return null;
    return formatPostCreatedAtDisplay(createdAtDate);
  }, [createdAtDate]);

  const totalLikes = likeCount;
  const totalComments = useMemo(
    () => comments.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0),
    [comments]
  );

  const displaySortedComments = useMemo(() => {
    const score = (row) => row.likeCount ?? 0;
    const byLikesThenNewer = (a, b) => {
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      return String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
    };

    return [...comments]
      .map((c) => ({
        ...c,
        replies: [...(c.replies ?? [])].sort(byLikesThenNewer),
      }))
      .sort(byLikesThenNewer);
  }, [comments]);

  useEffect(() => {
    if (!commentInputRef.current) return;

    commentInputRef.current.style.height = "auto";
    const lineHeight = 20;
    const maxHeight = lineHeight * MAX_COMMENT_INPUT_ROWS;
    const nextHeight = Math.min(commentInputRef.current.scrollHeight, maxHeight);
    commentInputRef.current.style.height = `${nextHeight}px`;
    commentInputRef.current.style.overflowY =
      commentInputRef.current.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [commentInput]);

  const closeCommentMenu = useCallback(() => {
    setOpenCommentMenuId(null);
    setCommentMenuAnchor(null);
  }, []);

  useEffect(() => {
    if (!isPostMenuOpen) return undefined;

    const handleOutsideClick = () => {
      setIsPostMenuOpen(false);
    };

    window.addEventListener("click", handleOutsideClick);
    return () => {
      window.removeEventListener("click", handleOutsideClick);
    };
  }, [isPostMenuOpen]);

  const handleSubmitComment = async (event) => {
    event.preventDefault();

    const cleanComment = commentInput.trim();
    if (!cleanComment) return;

    const nextComment = await onAddComment?.(post.id, cleanComment);
    if (nextComment) {
      setComments((prevComments) => [...prevComments, nextComment]);
    }
    setCommentInput("");
    setIsCommentOpen(true);
  };

  const handleCommentInputKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmitComment(event);
    }
  };

  const handleDeleteComment = async (commentId) => {
    await onDeleteComment?.(post.id, commentId);
    setReplyParentId((rp) => (rp === commentId ? null : rp));
    setComments((prevComments) => {
      const isTop = prevComments.some((c) => c.id === commentId);
      if (isTop) {
        return prevComments.filter((c) => c.id !== commentId);
      }
      return prevComments.map((c) => ({
        ...c,
        replies: (c.replies ?? []).filter((r) => r.id !== commentId),
      }));
    });
    closeCommentMenu();
    setEditingCommentId((prevEdit) => {
      if (prevEdit === commentId) {
        setEditingCommentText("");
        return null;
      }
      return prevEdit;
    });
  };

  const handleStartEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.text);
    closeCommentMenu();
  };

  const handleSaveEditComment = async () => {
    const cleanText = editingCommentText.trim();
    if (!cleanText || !editingCommentId) return;

    await onUpdateComment?.(post.id, editingCommentId, cleanText);
    setComments((prevComments) =>
      prevComments.map((comment) => {
        if (comment.id === editingCommentId) {
          return { ...comment, text: cleanText };
        }
        return {
          ...comment,
          replies: (comment.replies ?? []).map((r) =>
            r.id === editingCommentId ? { ...r, text: cleanText } : r
          ),
        };
      })
    );
    setEditingCommentId(null);
    setEditingCommentText("");
  };

  const toggleCommentLike = async (commentId) => {
    const data = await onToggleCommentLike?.(post.id, commentId);
    if (!data) return;

    setComments((prevComments) =>
      prevComments.map((comment) => {
        if (comment.id === commentId) {
          return { ...comment, likedByViewer: data.liked, likeCount: data.likeCount };
        }
        return {
          ...comment,
          replies: (comment.replies ?? []).map((reply) =>
            reply.id === commentId
              ? { ...reply, likedByViewer: data.liked, likeCount: data.likeCount }
              : reply
          ),
        };
      })
    );
  };

  const submitReplyUnder = async (parentId) => {
    const clean = replyInput.trim();
    if (!clean || !parentId) return;

    const newReply = await onAddReply?.(post.id, parentId, clean);
    if (!newReply) return;

    setComments((prev) =>
      prev.map((c) =>
        c.id === parentId ? { ...c, replies: [...(c.replies ?? []), newReply] } : c
      )
    );
    setReplyInput("");
    setReplyParentId(null);
  };

  const handleSubmitReply = (event, parentId) => {
    event.preventDefault();
    submitReplyUnder(parentId);
  };

  const handleReplyKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (replyParentId) submitReplyUnder(replyParentId);
    }
  };

  const toggleAnswerComposer = (commentId) => {
    setReplyParentId((prev) => (prev === commentId ? null : commentId));
    setReplyInput("");
  };

  const handleStartEditPost = () => {
    setEditingPostCaption(post.caption || "");
    setIsEditingPost(true);
    setIsPostMenuOpen(false);
  };

  const handleCancelEditPost = () => {
    setEditingPostCaption(post.caption || "");
    setIsEditingPost(false);
  };

  const handleSaveEditPost = async () => {
    const cleanCaption = editingPostCaption.trim();
    if (isSavingPost || (!cleanCaption && !post.imageUrl)) return;
    if (cleanCaption === (post.caption || "")) {
      setIsEditingPost(false);
      return;
    }

    setIsSavingPost(true);
    try {
      const updatedPost = await onUpdatePost?.(post.id, cleanCaption);
      if (updatedPost) {
        setEditingPostCaption(updatedPost.caption || "");
      }
      setIsEditingPost(false);
    } finally {
      setIsSavingPost(false);
    }
  };

  function renderCommentRow(comment, depth) {
    const replies = comment.replies ?? [];
    const baseLikes = comment.likeCount ?? 0;
    const viewerLiked = Boolean(comment.likedByViewer);
    const likeShown = baseLikes;
    const answerShown = depth === 0 ? replies.length : 0;
    const isNested = depth > 0;
    const canOpenAuthor = Boolean(comment.authorId && onOpenProfile);
    const openThisAuthor = () =>
      openAuthorProfile(onOpenProfile, comment.authorId, comment.authorName, comment.authorAvatar);

    return (
      <div className="flex items-start gap-2">
        <div className="shrink-0">
          {canOpenAuthor ? (
            <button
              type="button"
              onClick={openThisAuthor}
              className="rounded-full focus:outline-none"
              aria-label={`Open ${comment.authorName} profile`}
            >
              <CommentAvatar
                avatarUrl={comment.authorAvatar}
                authorName={comment.authorName}
                sm={isNested}
              />
            </button>
          ) : (
            <CommentAvatar
              avatarUrl={comment.authorAvatar}
              authorName={comment.authorName}
              sm={isNested}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className={`relative ${isNested ? "max-w-[92%]" : "max-w-[95%]"} pr-8`}>
            <div className="rounded-lg bg-[#f0f2f5] px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                {canOpenAuthor ? (
                  <button
                    type="button"
                    onClick={openThisAuthor}
                    className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-[#1c1e21] hover:underline"
                  >
                    {comment.authorName}
                  </button>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-[#1c1e21]">
                    {comment.authorName}
                  </span>
                )}
                <span className="shrink-0 whitespace-nowrap text-xs text-[#8a8d91]">
                  {commentCreatedAtLabel(comment.createdAt)}
                </span>
              </div>
              {editingCommentId === comment.id ? (
                <div className="mt-1 space-y-2">
                  <textarea
                    value={editingCommentText}
                    onChange={(event) => setEditingCommentText(event.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-md border border-[#dddfe2] bg-white px-2 py-1.5 text-sm text-[#1c1e21] outline-none focus:border-indigo-500"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveEditComment}
                      className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCommentId(null);
                        setEditingCommentText("");
                      }}
                      className="rounded-md px-2.5 py-1 text-xs font-semibold text-[#65676b] hover:bg-[#e4e6eb]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p
                  className={`mt-0.5 break-words whitespace-pre-wrap text-[#1c1e21] ${
                    isNested ? "text-[13px] leading-snug" : "text-sm"
                  }`}
                >
                  {comment.text}
                </p>
              )}
            </div>

            {comment.isOwn && editingCommentId !== comment.id && (
              <>
                <button
                  type="button"
                  ref={(el) => {
                    if (openCommentMenuId === comment.id && el && !commentMenuAnchor) {
                      setCommentMenuAnchor(el);
                    }
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (openCommentMenuId === comment.id) {
                      closeCommentMenu();
                    } else {
                      setCommentMenuAnchor(event.currentTarget);
                      setOpenCommentMenuId(comment.id);
                    }
                  }}
                  className="absolute right-0 bottom-1 flex h-6 w-6 items-center justify-center rounded-full text-[#65676b] transition hover:bg-[#e4e6eb]"
                  aria-label="Open comment menu"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M3 10a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0z" />
                  </svg>
                </button>

                {openCommentMenuId === comment.id && commentMenuAnchor && (
                  <CommentMenuPortal anchorEl={commentMenuAnchor} onClose={closeCommentMenu}>
                    <button
                      type="button"
                      onClick={() => handleStartEditComment(comment)}
                      className="w-full px-3 py-2 text-left text-sm text-[#1c1e21] hover:bg-[#f0f2f5]"
                    >
                      Edit comment
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteComment(comment.id)}
                      className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50"
                    >
                      Delete comment
                    </button>
                  </CommentMenuPortal>
                )}
              </>
            )}
          </div>

          <div
            className={`mt-1 flex items-center justify-between gap-2 text-xs text-[#65676b] ${
              isNested ? "max-w-[92%]" : "max-w-[95%]"
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span>{likeShown} likes</span>
              <span className="text-[#ccd0d5]">·</span>
              <span>{answerShown} answers</span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => toggleCommentLike(comment.id)}
                className={`flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition ${
                  viewerLiked ? "text-indigo-600" : "text-[#65676b] hover:bg-[#e4e6eb]"
                }`}
              >
                <IconThumbsUp />
                Like
              </button>
              {depth === 0 ? (
                <button
                  type="button"
                  onClick={() => toggleAnswerComposer(comment.id)}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition ${
                    replyParentId === comment.id
                      ? "text-indigo-600"
                      : "text-[#65676b] hover:bg-[#e4e6eb]"
                  }`}
                >
                  <IconReply />
                  Answer
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const canOpenPostAuthor = Boolean(post.authorId && onOpenProfile);
  const canManagePost = Boolean(post.isOwn || post.authorId === viewerId);
  const canSavePostEdit = Boolean(editingPostCaption.trim() || post.imageUrl);
  const openPostAuthor = () =>
    openAuthorProfile(onOpenProfile, post.authorId, post.authorName, post.authorAvatar);

  return (
    <article className="rounded-lg border border-[#e4e6eb] bg-white shadow-[0_2px_4px_rgba(0,0,0,0.08),0_8px_16px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-3 p-4">
        <div className="shrink-0">
          {canOpenPostAuthor ? (
            <button
              type="button"
              onClick={openPostAuthor}
              className="rounded-full focus:outline-none"
              aria-label={`Open ${post.authorName} profile`}
            >
              <img src={post.authorAvatar} alt={post.authorName} className="h-10 w-10 rounded-full object-cover" />
            </button>
          ) : (
            <img src={post.authorAvatar} alt={post.authorName} className="h-10 w-10 rounded-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {canOpenPostAuthor ? (
            <button
              type="button"
              onClick={openPostAuthor}
              className="block w-full truncate text-left text-sm font-semibold text-[#1c1e21] hover:underline"
            >
              {post.authorName}
            </button>
          ) : (
            <p className="truncate text-sm font-semibold text-[#1c1e21]">{post.authorName}</p>
          )}
          <p className="text-xs text-[#8a8d91]">
            {createdAtLabel ?? String(post.createdAt ?? "")}
          </p>
        </div>
        {canManagePost ? (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setIsPostMenuOpen((prev) => !prev);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#65676b] transition hover:bg-[#f0f2f5]"
              aria-label="Open post menu"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 10a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0z" />
              </svg>
            </button>
            {isPostMenuOpen ? (
              <div
                onClick={(event) => event.stopPropagation()}
                className="absolute right-0 top-9 z-10 min-w-[130px] rounded-md border border-[#e4e6eb] bg-white py-1 shadow-lg"
              >
                <button
                  type="button"
                  onClick={handleStartEditPost}
                  className="w-full px-3 py-2 text-left text-sm text-[#1c1e21] hover:bg-[#f0f2f5]"
                >
                  Edit post
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onDeletePost?.(post.id);
                    setIsPostMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50"
                >
                  Delete post
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {isEditingPost ? (
        <div className="px-4 pb-3">
          <textarea
            value={editingPostCaption}
            onChange={(event) => setEditingPostCaption(event.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-[#dddfe2] bg-white px-3 py-2 text-sm text-[#1c1e21] outline-none focus:border-indigo-500"
            autoFocus
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancelEditPost}
              disabled={isSavingPost}
              className="rounded-md px-3 py-1.5 text-sm font-semibold text-[#65676b] hover:bg-[#e4e6eb] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveEditPost}
              disabled={!canSavePostEdit || isSavingPost}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {isSavingPost ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <p className="px-4 pb-3 whitespace-pre-wrap text-sm text-[#1c1e21]">{post.caption}</p>
      )}

      {post.imageUrl ? (
        <div className="bg-[#f0f2f5]">
          <img
            src={post.imageUrl}
            alt="Feed post"
            className="max-h-96 w-full object-contain"
          />
        </div>
      ) : null}

      <div className="flex items-center justify-between border-t border-[#f0f2f5] px-4 py-3 text-xs font-medium text-[#65676b]">
        <span>{totalLikes} likes</span>
        <span>{totalComments} comments</span>
      </div>

      <div className="grid grid-cols-4 border-t border-[#f0f2f5] px-3 py-2">
        <button
          type="button"
          onClick={async () => {
            const data = await onTogglePostLike?.(post.id);
            if (data) {
              setIsLiked(Boolean(data.liked));
              setLikeCount(data.likeCount);
            }
          }}
          className={`col-start-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition ${
            isLiked ? "bg-indigo-50 text-indigo-600" : "text-[#65676b] hover:bg-[#f0f2f5]"
          }`}
        >
          <svg
            className="h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
            <path d="M7 10v12" />
          </svg>
          Like
        </button>
        <button
          type="button"
          onClick={() => setIsCommentOpen((prevState) => !prevState)}
          className={`col-start-4 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition ${
            isCommentOpen ? "bg-indigo-50 text-indigo-600" : "text-[#65676b] hover:bg-[#f0f2f5]"
          }`}
        >
          <svg
            className="h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
          </svg>
          Comment
        </button>
      </div>

      {isCommentOpen && (
        <div className="space-y-3 border-t border-[#f0f2f5] px-4 py-3">
          <div className="max-h-[300px] space-y-3 overflow-y-auto overflow-x-visible pr-1">
            {displaySortedComments.map((comment) => (
              <div key={comment.id} className="space-y-2">
                {renderCommentRow(comment, 0)}
                {(comment.replies ?? []).map((reply) => (
                  <div key={reply.id} className="ml-8 border-l-2 border-[#e4e6eb] pl-3">
                    {renderCommentRow(reply, 1)}
                  </div>
                ))}
                {replyParentId === comment.id ? (
                  <form
                    className="ml-10 flex items-end gap-2 border-l-2 border-[#e4e6eb] pl-3"
                    onSubmit={(event) => handleSubmitReply(event, comment.id)}
                  >
                    <textarea
                      value={replyInput}
                      onChange={(event) => setReplyInput(event.target.value)}
                      onKeyDown={handleReplyKeyDown}
                      placeholder="Write an answer..."
                      rows={2}
                      className="min-h-[44px] flex-1 resize-none rounded-xl border border-[#dddfe2] bg-white px-3 py-2 text-[13px] leading-snug outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={!replyInput.trim()}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                      aria-label="Post answer"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M21.999 2.813a1 1 0 00-1.356-.93L2.32 9.21a1 1 0 00.067 1.87l7.207 2.403 2.404 7.206a1 1 0 001.87.067l7.327-18.322a.998.998 0 00-.196-1.093zM11.168 12.83l-5.2-1.734L18.186 6.21l-7.018 6.62zm1.734 5.2l-1.733-5.2 6.62-7.018-4.887 12.218z" />
                      </svg>
                    </button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmitComment} className="flex items-end gap-2">
            <textarea
              ref={commentInputRef}
              value={commentInput}
              onChange={(event) => setCommentInput(event.target.value)}
              onKeyDown={handleCommentInputKeyDown}
              placeholder="Write a comment..."
              rows={1}
              className="min-h-[40px] max-h-[60px] flex-1 resize-none rounded-2xl border border-[#dddfe2] bg-white px-4 py-2 text-sm leading-5 outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={!commentInput.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
              aria-label="Post comment"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21.999 2.813a1 1 0 00-1.356-.93L2.32 9.21a1 1 0 00.067 1.87l7.207 2.403 2.404 7.206a1 1 0 001.87.067l7.327-18.322a.998.998 0 00-.196-1.093zM11.168 12.83l-5.2-1.734L18.186 6.21l-7.018 6.62zm1.734 5.2l-1.733-5.2 6.62-7.018-4.887 12.218z" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
