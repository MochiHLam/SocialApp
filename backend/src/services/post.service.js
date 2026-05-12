import mongoose from "mongoose";
import sharp from "sharp";
import { Readable } from "node:stream";

import { getCloudinary } from "../config/cloudinary.js";
import FriendRequest from "../models/FriendRequest.js";
import Post from "../models/Post.js";
import { AppError } from "../utils/app-error.js";

const DEFAULT_POST_LIMIT = 20;
const USER_SELECT_FIELDS = "displayName avatarUrl email";

function toIdString(value) {
  return String(value?._id || value || "");
}

function parseLimit(rawLimit, fallback = DEFAULT_POST_LIMIT, max = 50) {
  return Math.min(Math.max(Number.parseInt(rawLimit, 10) || fallback, 1), max);
}

function assertObjectId(value, message = "Invalid id") {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(message, 400);
  }
}

function buildPairQuery(leftId, rightId) {
  const left = toIdString(leftId);
  const right = toIdString(rightId);

  return left < right
    ? { pairLowId: left, pairHighId: right }
    : { pairLowId: right, pairHighId: left };
}

function buildAuthor(user) {
  return {
    id: toIdString(user),
    displayName: user?.displayName || user?.email?.split?.("@")?.[0] || "User",
    avatarUrl: user?.avatarUrl || "",
  };
}

function sanitizeComment(comment, currentUserId) {
  const author = buildAuthor(comment.authorId);
  const currentId = toIdString(currentUserId);
  const likedBy = comment.likedBy || [];

  return {
    id: toIdString(comment),
    authorId: author.id,
    authorName: author.displayName,
    authorAvatar: author.avatarUrl,
    text: comment.text,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    isOwn: author.id === currentId,
    likeCount: likedBy.length,
    likedByViewer: likedBy.some((id) => toIdString(id) === currentId),
    replies: (comment.replies || []).map((reply) => {
      const replyAuthor = buildAuthor(reply.authorId);
      const replyLikedBy = reply.likedBy || [];
      return {
        id: toIdString(reply),
        authorId: replyAuthor.id,
        authorName: replyAuthor.displayName,
        authorAvatar: replyAuthor.avatarUrl,
        text: reply.text,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
        isOwn: replyAuthor.id === currentId,
        likeCount: replyLikedBy.length,
        likedByViewer: replyLikedBy.some((id) => toIdString(id) === currentId),
      };
    }),
  };
}

function sanitizePost(post, currentUserId) {
  const author = buildAuthor(post.authorId);
  const currentId = toIdString(currentUserId);
  const likedBy = post.likedBy || [];

  return {
    _id: toIdString(post),
    id: toIdString(post),
    authorId: author.id,
    authorName: author.displayName,
    authorAvatar: author.avatarUrl,
    caption: post.caption || "",
    imageUrl: post.imageUrl || "",
    likeCount: likedBy.length,
    likedByViewer: likedBy.some((id) => toIdString(id) === currentId),
    isOwn: author.id === currentId,
    comments: (post.comments || []).map((comment) => sanitizeComment(comment, currentUserId)),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

async function populatePostById(postId) {
  return Post.findById(postId)
    .populate("authorId", USER_SELECT_FIELDS)
    .populate("comments.authorId", USER_SELECT_FIELDS)
    .populate("comments.replies.authorId", USER_SELECT_FIELDS);
}

async function uploadPostImageBuffer(buffer) {
  const cloudinary = getCloudinary();
  const processedBuffer = await sharp(buffer)
    .rotate()
    .resize(1800, 1800, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "chatapp/posts",
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      },
    );

    Readable.from([processedBuffer]).pipe(uploadStream);
  });
}

function findCommentOrReply(post, commentId) {
  for (const comment of post.comments || []) {
    if (toIdString(comment) === toIdString(commentId)) {
      return { comment, parent: null };
    }
    const reply = (comment.replies || []).find((row) => toIdString(row) === toIdString(commentId));
    if (reply) return { comment: reply, parent: comment };
  }
  return { comment: null, parent: null };
}

async function getVisiblePostAuthorIds(currentUserId) {
  const currentId = toIdString(currentUserId);
  const relations = await FriendRequest.find({
    status: "accepted",
    $or: [{ requestedById: currentUserId }, { receiverId: currentUserId }],
  }).select("requestedById receiverId");

  const authorIds = new Set([currentId]);
  relations.forEach((relation) => {
    const requesterId = toIdString(relation.requestedById);
    const receiverId = toIdString(relation.receiverId);
    authorIds.add(requesterId === currentId ? receiverId : requesterId);
  });

  return [...authorIds];
}

async function assertCanViewPost(currentUserId, post) {
  const currentId = toIdString(currentUserId);
  const authorId = toIdString(post?.authorId);

  if (!post) throw new AppError("Post not found", 404);
  if (authorId === currentId) return;

  const relation = await FriendRequest.findOne({
    ...buildPairQuery(currentId, authorId),
    status: "accepted",
  }).select("_id");

  if (!relation) {
    throw new AppError("Post not found", 404);
  }
}

export async function listPosts(currentUserId, { limit: rawLimit, before } = {}) {
  const limit = parseLimit(rawLimit);
  const visibleAuthorIds = await getVisiblePostAuthorIds(currentUserId);
  const query = {
    authorId: { $in: visibleAuthorIds },
  };

  if (before) {
    const beforeDate = new Date(before);
    if (Number.isNaN(beforeDate.getTime())) {
      throw new AppError("Invalid post cursor", 400);
    }
    query.createdAt = { $lt: beforeDate };
  }

  const posts = await Post.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .populate("authorId", USER_SELECT_FIELDS)
    .populate("comments.authorId", USER_SELECT_FIELDS)
    .populate("comments.replies.authorId", USER_SELECT_FIELDS);

  const hasMore = posts.length > limit;
  const visiblePosts = hasMore ? posts.slice(0, limit) : posts;

  return {
    posts: visiblePosts.map((post) => sanitizePost(post, currentUserId)),
    pageInfo: {
      hasMore,
      nextBefore: visiblePosts.at(-1)?.createdAt || null,
    },
  };
}

export async function createPost(currentUserId, { caption = "" } = {}, file) {
  const cleanCaption = typeof caption === "string" ? caption.trim() : "";

  if (cleanCaption.length > 4000) {
    throw new AppError("Post caption must be at most 4000 characters long", 400);
  }

  if (!cleanCaption && !file?.buffer) {
    throw new AppError("Post text or image is required", 400);
  }

  let uploadResult = null;
  if (file?.buffer) {
    uploadResult = await uploadPostImageBuffer(file.buffer);
    if (!uploadResult?.secure_url) {
      throw new AppError("Failed to upload post image", 500);
    }
  }

  const post = await Post.create({
    authorId: currentUserId,
    caption: cleanCaption,
    imageUrl: uploadResult?.secure_url || "",
    imagePublicId: uploadResult?.public_id || "",
  });
  const populatedPost = await populatePostById(post._id);

  return sanitizePost(populatedPost, currentUserId);
}

export async function togglePostLike(currentUserId, postId) {
  assertObjectId(postId, "Invalid post id");

  const post = await Post.findById(postId);
  await assertCanViewPost(currentUserId, post);

  const currentId = toIdString(currentUserId);
  const alreadyLiked = post.likedBy.some((id) => toIdString(id) === currentId);
  post.likedBy = alreadyLiked
    ? post.likedBy.filter((id) => toIdString(id) !== currentId)
    : [...post.likedBy, currentUserId];
  await post.save();

  return {
    liked: !alreadyLiked,
    likeCount: post.likedBy.length,
  };
}

export async function updatePost(currentUserId, postId, { caption = "" } = {}) {
  assertObjectId(postId, "Invalid post id");
  const cleanCaption = typeof caption === "string" ? caption.trim() : "";

  if (cleanCaption.length > 4000) {
    throw new AppError("Post caption must be at most 4000 characters long", 400);
  }

  const post = await Post.findById(postId);
  if (!post) throw new AppError("Post not found", 404);
  if (toIdString(post.authorId) !== toIdString(currentUserId)) {
    throw new AppError("You can only edit your own posts", 403);
  }

  if (!cleanCaption && !post.imageUrl) {
    throw new AppError("Post text or image is required", 400);
  }

  post.caption = cleanCaption;
  await post.save();

  const populatedPost = await populatePostById(post._id);
  return sanitizePost(populatedPost, currentUserId);
}

export async function deletePost(currentUserId, postId) {
  assertObjectId(postId, "Invalid post id");

  const post = await Post.findById(postId);
  if (!post) throw new AppError("Post not found", 404);
  if (toIdString(post.authorId) !== toIdString(currentUserId)) {
    throw new AppError("You can only delete your own posts", 403);
  }

  await post.deleteOne();

  return {
    postId: toIdString(postId),
  };
}

export async function addComment(currentUserId, postId, { text = "" } = {}) {
  assertObjectId(postId, "Invalid post id");
  const cleanText = typeof text === "string" ? text.trim() : "";
  if (!cleanText) throw new AppError("Comment text is required", 400);
  if (cleanText.length > 1000) throw new AppError("Comment must be at most 1000 characters long", 400);

  const post = await Post.findById(postId);
  await assertCanViewPost(currentUserId, post);

  post.comments.push({
    authorId: currentUserId,
    text: cleanText,
  });
  await post.save();

  const populatedPost = await populatePostById(postId);
  const comment = populatedPost.comments.at(-1);
  return sanitizeComment(comment, currentUserId);
}

export async function addReply(currentUserId, postId, parentCommentId, { text = "" } = {}) {
  assertObjectId(postId, "Invalid post id");
  assertObjectId(parentCommentId, "Invalid comment id");
  const cleanText = typeof text === "string" ? text.trim() : "";
  if (!cleanText) throw new AppError("Reply text is required", 400);
  if (cleanText.length > 1000) throw new AppError("Reply must be at most 1000 characters long", 400);

  const post = await Post.findById(postId);
  await assertCanViewPost(currentUserId, post);

  const parentComment = post.comments.id(parentCommentId);
  if (!parentComment) throw new AppError("Comment not found", 404);

  parentComment.replies.push({
    authorId: currentUserId,
    text: cleanText,
  });
  await post.save();

  const populatedPost = await populatePostById(postId);
  const populatedParent = populatedPost.comments.id(parentCommentId);
  const reply = populatedParent.replies.at(-1);
  return sanitizeComment({ ...reply.toObject(), authorId: reply.authorId, replies: [] }, currentUserId);
}

export async function updateComment(currentUserId, postId, commentId, { text = "" } = {}) {
  assertObjectId(postId, "Invalid post id");
  assertObjectId(commentId, "Invalid comment id");
  const cleanText = typeof text === "string" ? text.trim() : "";
  if (!cleanText) throw new AppError("Comment text is required", 400);
  if (cleanText.length > 1000) throw new AppError("Comment must be at most 1000 characters long", 400);

  const post = await Post.findById(postId);
  await assertCanViewPost(currentUserId, post);

  const { comment } = findCommentOrReply(post, commentId);
  if (!comment) throw new AppError("Comment not found", 404);
  if (toIdString(comment.authorId) !== toIdString(currentUserId)) {
    throw new AppError("You can only edit your own comments", 403);
  }

  comment.text = cleanText;
  await post.save();

  return {
    commentId: toIdString(commentId),
    text: cleanText,
  };
}

export async function deleteComment(currentUserId, postId, commentId) {
  assertObjectId(postId, "Invalid post id");
  assertObjectId(commentId, "Invalid comment id");

  const post = await Post.findById(postId);
  await assertCanViewPost(currentUserId, post);

  const { comment, parent } = findCommentOrReply(post, commentId);
  if (!comment) throw new AppError("Comment not found", 404);
  if (toIdString(comment.authorId) !== toIdString(currentUserId)) {
    throw new AppError("You can only delete your own comments", 403);
  }

  if (parent) {
    parent.replies.pull(commentId);
  } else {
    post.comments.pull(commentId);
  }
  await post.save();

  return {
    commentId: toIdString(commentId),
  };
}

export async function toggleCommentLike(currentUserId, postId, commentId) {
  assertObjectId(postId, "Invalid post id");
  assertObjectId(commentId, "Invalid comment id");

  const post = await Post.findById(postId);
  await assertCanViewPost(currentUserId, post);

  const { comment } = findCommentOrReply(post, commentId);
  if (!comment) throw new AppError("Comment not found", 404);

  const currentId = toIdString(currentUserId);
  const alreadyLiked = comment.likedBy.some((id) => toIdString(id) === currentId);
  comment.likedBy = alreadyLiked
    ? comment.likedBy.filter((id) => toIdString(id) !== currentId)
    : [...comment.likedBy, currentUserId];
  await post.save();

  return {
    commentId: toIdString(commentId),
    liked: !alreadyLiked,
    likeCount: comment.likedBy.length,
  };
}
