import { axiosInstance } from './axios.js';

// --- Auth ---

export const login = async ({ email, password }) => {
  const response = await axiosInstance.post('/auth/login', { email, password });
  return response.data;
};

export const requestSignupOtp = async ({ email }) => {
  const response = await axiosInstance.post('/auth/request-signup-otp', { email });
  return response.data;
};

export const verifyOtp = async ({ email, otpCode }) => {
  const response = await axiosInstance.post('/auth/verify-otp', { email, otpCode });
  return response.data;
};

export const completeRegistration = async ({
  email,
  password,
  displayName,
  gender,
  day,
  month,
  year,
}) => {
  const response = await axiosInstance.post('/auth/complete-registration', {
    email,
    password,
    displayName,
    gender,
    day,
    month,
    year,
  });
  return response.data;
};

export const logout = async () => {
  const response = await axiosInstance.post('/auth/logout');
  return response.data;
};

export const getMyProfile = async () => {
  const response = await axiosInstance.get('/users/me');
  return response.data;
};

export const updateMyProfile = async (data) => {
  const response = await axiosInstance.patch('/users/me', data);
  return response.data;
};

export const uploadMyAvatar = async (file) => {
  const formData = new FormData();
  formData.append('avatar', file);

  const response = await axiosInstance.post('/users/me/avatar', formData);
  return response.data;
};

export const searchUsers = async ({ q, limit = 20 } = {}) => {
  const response = await axiosInstance.get('/users/search', {
    params: {
      q,
      limit,
    },
  });
  return response.data;
};

export const getUserProfile = async ({ userId }) => {
  const response = await axiosInstance.get(`/users/${userId}`);
  return response.data;
};

// --- Friends ---

export const getFriends = async ({ q, limit = 20 } = {}) => {
  const response = await axiosInstance.get('/friends', {
    params: {
      q,
      limit,
    },
  });
  return response.data;
};

export const getFriendRequests = async ({ q, limit = 20 } = {}) => {
  const response = await axiosInstance.get('/friends/requests', {
    params: {
      q,
      limit,
    },
  });
  return response.data;
};

export const createFriendRequest = async ({ receiverId }) => {
  const response = await axiosInstance.post('/friends/requests', { receiverId });
  return response.data;
};

export const cancelFriendRequest = async ({ requestId }) => {
  const response = await axiosInstance.delete(`/friends/requests/${requestId}/cancel`);
  return response.data;
};

export const acceptFriendRequest = async ({ requestId }) => {
  const response = await axiosInstance.post(`/friends/requests/${requestId}/accept`);
  return response.data;
};

export const declineFriendRequest = async ({ requestId }) => {
  const response = await axiosInstance.delete(`/friends/requests/${requestId}`);
  return response.data;
};

export const removeFriend = async ({ relationshipId }) => {
  const response = await axiosInstance.delete(`/friends/${relationshipId}`);
  return response.data;
};

// --- Chat ---

export const getChatConversations = async ({ limit = 50 } = {}) => {
  const response = await axiosInstance.get('/chat/conversations', {
    params: {
      limit,
    },
  });
  return response.data;
};

export const createDirectConversation = async ({ friendId }) => {
  const response = await axiosInstance.post(`/chat/conversations/direct/${friendId}`);
  return response.data;
};

export const getChatMessages = async ({ conversationId, limit = 50, before } = {}) => {
  const response = await axiosInstance.get(`/chat/conversations/${conversationId}/messages`, {
    params: {
      limit,
      before,
    },
  });
  return response.data;
};

export const sendChatMessage = async ({ conversationId, text, imageUrl }) => {
  const response = await axiosInstance.post(`/chat/conversations/${conversationId}/messages`, {
    text,
    imageUrl,
  });
  return response.data;
};

export const sendChatImage = async ({ conversationId, file }) => {
  const formData = new FormData();
  formData.append('image', file);

  const response = await axiosInstance.post(`/chat/conversations/${conversationId}/images`, formData);
  return response.data;
};

export const markChatConversationRead = async ({ conversationId }) => {
  const response = await axiosInstance.patch(`/chat/conversations/${conversationId}/read`);
  return response.data;
};

export const hideChatConversation = async ({ conversationId }) => {
  const response = await axiosInstance.patch(`/chat/conversations/${conversationId}/hide`);
  return response.data;
};

export const deleteChatMessage = async ({ messageId }) => {
  const response = await axiosInstance.delete(`/chat/messages/${messageId}`);
  return response.data;
};

// --- Posts ---

export const getPosts = async ({ limit = 20, before } = {}) => {
  const response = await axiosInstance.get('/posts', {
    params: {
      limit,
      before,
    },
  });
  return response.data;
};

export const createPost = async ({ caption, image } = {}) => {
  const formData = new FormData();
  if (caption) formData.append('caption', caption);
  if (image) formData.append('image', image);

  const response = await axiosInstance.post('/posts', formData);
  return response.data;
};

export const togglePostLike = async ({ postId }) => {
  const response = await axiosInstance.post(`/posts/${postId}/likes`);
  return response.data;
};

export const updatePost = async ({ postId, caption }) => {
  const response = await axiosInstance.patch(`/posts/${postId}`, { caption });
  return response.data;
};

export const deletePost = async ({ postId }) => {
  const response = await axiosInstance.delete(`/posts/${postId}`);
  return response.data;
};

export const addPostComment = async ({ postId, text }) => {
  const response = await axiosInstance.post(`/posts/${postId}/comments`, { text });
  return response.data;
};

export const addPostReply = async ({ postId, commentId, text }) => {
  const response = await axiosInstance.post(`/posts/${postId}/comments/${commentId}/replies`, { text });
  return response.data;
};

export const updatePostComment = async ({ postId, commentId, text }) => {
  const response = await axiosInstance.patch(`/posts/${postId}/comments/${commentId}`, { text });
  return response.data;
};

export const deletePostComment = async ({ postId, commentId }) => {
  const response = await axiosInstance.delete(`/posts/${postId}/comments/${commentId}`);
  return response.data;
};

export const togglePostCommentLike = async ({ postId, commentId }) => {
  const response = await axiosInstance.post(`/posts/${postId}/comments/${commentId}/likes`);
  return response.data;
};

// --- Google Auth ---

export const googleLogin = async ({ idToken }) => {
  const response = await axiosInstance.post('/auth/google', { idToken });
  return response.data;
};

export const completeGoogleRegistration = async (data) => {
  const response = await axiosInstance.post('/auth/complete-google-registration', data);
  return response.data;
};

// --- Forgot Password ---

export const requestForgotPasswordOtp = async ({ email }) => {
  const response = await axiosInstance.post('/auth/forgot-password/request-otp', { email });
  return response.data;
};

export const verifyForgotPasswordOtp = async ({ email, otpCode }) => {
  const response = await axiosInstance.post('/auth/forgot-password/verify-otp', { email, otpCode });
  return response.data;
};

export const resetPasswordWithOtp = async ({ email, otpCode, newPassword }) => {
  const response = await axiosInstance.post('/auth/forgot-password/reset', { email, otpCode, newPassword });
  return response.data;
};

export const changePassword = async ({ currentPassword, newPassword }) => {
  const response = await axiosInstance.post('/auth/change-password', { currentPassword, newPassword });
  return response.data;
};
