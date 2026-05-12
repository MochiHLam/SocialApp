import { Router } from "express";

import {
  getCurrentUserHandler,
  getUserProfileHandler,
  searchUsersHandler,
  updateCurrentUserAvatarHandler,
  updateCurrentUserHandler,
} from "../controllers/user.controller.js";
import { asyncHandler } from "../utils/async-handler.js";
import { validateBody } from "../middlewares/validation.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { avatarUpload } from "../middlewares/upload.middleware.js";
import { updateProfileSchema } from "../validation/auth.schemas.js";

const router = Router();

router.get("/me", requireAuth, asyncHandler(getCurrentUserHandler));
router.get("/search", requireAuth, asyncHandler(searchUsersHandler));
router.patch("/me", requireAuth, validateBody(updateProfileSchema), asyncHandler(updateCurrentUserHandler));
router.post("/me/avatar", requireAuth, avatarUpload.single("avatar"), asyncHandler(updateCurrentUserAvatarHandler));
router.get("/:userId", requireAuth, asyncHandler(getUserProfileHandler));

export default router;
