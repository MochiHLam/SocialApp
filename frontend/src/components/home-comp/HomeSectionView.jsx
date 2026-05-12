import { useCallback, useEffect, useRef, useState } from "react";

import FeedComposer from "./feed/FeedComposer.jsx";
import FeedPostCard from "./feed/FeedPostCard.jsx";
import PostSkeleton from "./feed/PostSkeleton.jsx";
import { HOME_SECTION, HOME_SUB_SECTION } from "../../lib/homeSections";
import {
  addPostComment,
  addPostReply,
  createPost,
  deletePost,
  deletePostComment,
  getPosts,
  togglePostCommentLike,
  togglePostLike,
  updatePostComment,
  updatePost,
} from "../../lib/api.js";

const POST_PAGE_LIMIT = 20;

export default function HomeSectionView({ displayName, user, subSection, onOpenProfile, onSelectSection }) {
  const [composerText, setComposerText] = useState("");
  const [composerImageUrl, setComposerImageUrl] = useState("");
  const [composerImageFile, setComposerImageFile] = useState(null);
  const [isPosting, setIsPosting] = useState(false);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isLoadingMorePosts, setIsLoadingMorePosts] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [nextPostsCursor, setNextPostsCursor] = useState(null);
  const [feedError, setFeedError] = useState("");
  const [feedPosts, setFeedPosts] = useState([]);
  const composerFileInputRef = useRef(null);
  const composerObjectUrlsRef = useRef(new Set());
  const feedLoadMoreRef = useRef(null);
  const activeSubSection = subSection || HOME_SUB_SECTION.home_feed;

  useEffect(() => {
    return () => {
      composerObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      composerObjectUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadPosts() {
      setIsLoadingPosts(true);
      setFeedError("");
      try {
        const data = await getPosts({ limit: POST_PAGE_LIMIT });
        if (isMounted) {
          setFeedPosts(data?.posts || []);
          setHasMorePosts(Boolean(data?.pageInfo?.hasMore));
          setNextPostsCursor(data?.pageInfo?.nextBefore || null);
        }
      } catch (err) {
        if (isMounted) setFeedError(err.message || "Failed to load posts");
      } finally {
        if (isMounted) setIsLoadingPosts(false);
      }
    }

    loadPosts();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLoadMorePosts = useCallback(async () => {
    if (!hasMorePosts || !nextPostsCursor || isLoadingMorePosts || isLoadingPosts) return;

    setIsLoadingMorePosts(true);
    setFeedError("");

    try {
      const data = await getPosts({
        limit: POST_PAGE_LIMIT,
        before: nextPostsCursor,
      });
      const nextPosts = data?.posts || [];

      setFeedPosts((prevPosts) => {
        const existingIds = new Set(prevPosts.map((post) => post.id));
        return [
          ...prevPosts,
          ...nextPosts.filter((post) => !existingIds.has(post.id)),
        ];
      });
      setHasMorePosts(Boolean(data?.pageInfo?.hasMore));
      setNextPostsCursor(data?.pageInfo?.nextBefore || null);
    } catch (err) {
      setFeedError(err.message || "Failed to load more posts");
    } finally {
      setIsLoadingMorePosts(false);
    }
  }, [hasMorePosts, isLoadingMorePosts, isLoadingPosts, nextPostsCursor]);

  useEffect(() => {
    const loadMoreElement = feedLoadMoreRef.current;
    if (!loadMoreElement || activeSubSection !== HOME_SUB_SECTION.home_feed) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          handleLoadMorePosts();
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(loadMoreElement);
    return () => observer.disconnect();
  }, [activeSubSection, handleLoadMorePosts]);

  const handleCreatePost = async () => {
    const cleanText = composerText.trim();
    if ((!cleanText && !composerImageUrl) || isPosting) return;

    setIsPosting(true);
    setFeedError("");

    try {
      const data = await createPost({
        caption: cleanText,
        image: composerImageFile,
      });

      if (data?.post) {
        setFeedPosts((prevPosts) => [data.post, ...prevPosts]);
      }
      setComposerText("");
      if (composerImageUrl) {
        URL.revokeObjectURL(composerImageUrl);
        composerObjectUrlsRef.current.delete(composerImageUrl);
      }
      setComposerImageUrl("");
      setComposerImageFile(null);
    } catch (err) {
      setFeedError(err.message || "Failed to create post");
    } finally {
      setIsPosting(false);
    }
  };

  const handleComposerKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleCreatePost();
    }
  };

  const handleAttachImage = (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (composerImageUrl) URL.revokeObjectURL(composerImageUrl);
    composerObjectUrlsRef.current.delete(composerImageUrl);
    const previewUrl = URL.createObjectURL(selectedFile);
    composerObjectUrlsRef.current.add(previewUrl);
    setComposerImageUrl(previewUrl);
    setComposerImageFile(selectedFile);
    event.target.value = "";
  };

  const updatePostById = (postId, updater) => {
    setFeedPosts((prevPosts) => prevPosts.map((post) => (
      post.id === postId ? updater(post) : post
    )));
  };

  const handleTogglePostLike = async (postId) => {
    const data = await togglePostLike({ postId });
    updatePostById(postId, (post) => ({
      ...post,
      likedByViewer: data.liked,
      likeCount: data.likeCount,
    }));
    return data;
  };

  const handleDeletePost = async (postId) => {
    await deletePost({ postId });
    setFeedPosts((prevPosts) => prevPosts.filter((post) => post.id !== postId));
  };

  const handleUpdatePost = async (postId, caption) => {
    const data = await updatePost({ postId, caption });
    if (data?.post) {
      updatePostById(postId, () => data.post);
    }
    return data?.post;
  };

  const handleAddComment = async (postId, text) => {
    const data = await addPostComment({ postId, text });
    if (data?.comment) {
      updatePostById(postId, (post) => ({
        ...post,
        comments: [...(post.comments || []), data.comment],
      }));
    }
    return data?.comment;
  };

  const handleAddReply = async (postId, commentId, text) => {
    const data = await addPostReply({ postId, commentId, text });
    if (data?.reply) {
      updatePostById(postId, (post) => ({
        ...post,
        comments: (post.comments || []).map((comment) => (
          comment.id === commentId
            ? { ...comment, replies: [...(comment.replies || []), data.reply] }
            : comment
        )),
      }));
    }
    return data?.reply;
  };

  const handleUpdateComment = async (postId, commentId, text) => {
    await updatePostComment({ postId, commentId, text });
    updatePostById(postId, (post) => ({
      ...post,
      comments: (post.comments || []).map((comment) => {
        if (comment.id === commentId) return { ...comment, text };
        return {
          ...comment,
          replies: (comment.replies || []).map((reply) => (
            reply.id === commentId ? { ...reply, text } : reply
          )),
        };
      }),
    }));
  };

  const handleDeleteComment = async (postId, commentId) => {
    await deletePostComment({ postId, commentId });
    updatePostById(postId, (post) => ({
      ...post,
      comments: (post.comments || [])
        .filter((comment) => comment.id !== commentId)
        .map((comment) => ({
          ...comment,
          replies: (comment.replies || []).filter((reply) => reply.id !== commentId),
        })),
    }));
  };

  const handleToggleCommentLike = async (postId, commentId) => {
    const data = await togglePostCommentLike({ postId, commentId });
    updatePostById(postId, (post) => ({
      ...post,
      comments: (post.comments || []).map((comment) => {
        if (comment.id === commentId) {
          return { ...comment, likedByViewer: data.liked, likeCount: data.likeCount };
        }
        return {
          ...comment,
          replies: (comment.replies || []).map((reply) => (
            reply.id === commentId
              ? { ...reply, likedByViewer: data.liked, likeCount: data.likeCount }
              : reply
          )),
        };
      }),
    }));
    return data;
  };

  if (activeSubSection !== HOME_SUB_SECTION.home_feed) return null;

  return (
    <div className="mx-auto w-full max-w-[900px] space-y-4 px-4 py-6">
      <FeedComposer
        displayName={displayName}
        user={user}
        onAvatarClick={() => onSelectSection?.(HOME_SECTION.profile)}
        composerText={composerText}
        onComposerTextChange={setComposerText}
        onComposerKeyDown={handleComposerKeyDown}
        composerImageUrl={composerImageUrl}
        onAttachImage={handleAttachImage}
        composerFileInputRef={composerFileInputRef}
        onCreatePost={handleCreatePost}
        isPosting={isPosting}
        canPost={Boolean(composerText.trim() || composerImageUrl)}
      />

      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-bold text-[#1c1e21]">Feed</h2>
      </div>
      <div className="space-y-4">
        {feedError ? (
          <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {feedError}
          </div>
        ) : null}
        {isLoadingPosts ? (
          <>
            <PostSkeleton />
            <PostSkeleton />
          </>
        ) : null}
        {feedPosts.map((post) => (
          <FeedPostCard
            key={post.id}
            post={post}
            viewerId={user?.id}
            onOpenProfile={onOpenProfile}
            onTogglePostLike={handleTogglePostLike}
            onUpdatePost={handleUpdatePost}
            onDeletePost={handleDeletePost}
            onAddComment={handleAddComment}
            onAddReply={handleAddReply}
            onUpdateComment={handleUpdateComment}
            onDeleteComment={handleDeleteComment}
            onToggleCommentLike={handleToggleCommentLike}
          />
        ))}
        {isPosting && <PostSkeleton />}
        {isLoadingMorePosts ? <PostSkeleton /> : null}
        {hasMorePosts ? <div ref={feedLoadMoreRef} className="h-4" aria-hidden /> : null}
        {!isLoadingPosts && !feedPosts.length && !feedError ? (
          <div className="rounded-lg border border-[#e4e6eb] bg-white px-4 py-8 text-center text-sm font-medium text-[#65676b]">
            No posts yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
