import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { AppError } from "./app-error.js";

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      provider: user.provider,
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn,
    },
  );
}

export function signGoogleSignupToken(payload) {
  return jwt.sign(
    { type: "google_signup", ...payload },
    env.jwtSecret,
    { expiresIn: "15m" },
  );
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch (_err) {
    throw new AppError("Invalid or expired token", 401);
  }
}

export function verifyGoogleSignupToken(token) {
  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    if (decoded.type !== "google_signup") {
      throw new AppError("Invalid token type", 400);
    }
    return decoded;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("Invalid or expired Google signup token", 401);
  }
}
