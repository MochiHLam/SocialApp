import {
  getCurrentUserProfile,
  getUserProfileById,
  searchUsers,
  updateCurrentUserAvatar,
  updateCurrentUserProfile,
} from "../services/user.service.js";

/** GET /users/me */
export async function getCurrentUserHandler(req, res) {
  const user = await getCurrentUserProfile(req.user.id);

  res.json({
    success: true,
    user,
  });
}

/** GET /users/:userId */
export async function getUserProfileHandler(req, res) {
  const profile = await getUserProfileById(req.user.id, req.params.userId);

  res.json({
    success: true,
    user: profile,
  });
}

/** PATCH /users/me */
export async function updateCurrentUserHandler(req, res) {
  const user = await updateCurrentUserProfile(req.user.id, req.body);

  res.json({
    success: true,
    message: "Profile updated successfully.",
    user,
  });
}

/** POST /users/me/avatar */
export async function updateCurrentUserAvatarHandler(req, res) {
  const user = await updateCurrentUserAvatar(req.user.id, req.file);

  res.json({
    success: true,
    message: "Profile photo updated successfully.",
    user,
  });
}

/** GET /users/search */
export async function searchUsersHandler(req, res) {
  const results = await searchUsers(req.user.id, req.query.q, req.query.limit);

  res.json({
    success: true,
    users: results,
  });
}
