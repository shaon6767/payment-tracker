import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import { HttpError } from "../utils/httpError.js";

export async function protect(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new HttpError(401, "Not authorized, no token");

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new HttpError(401, "Not authorized, token failed");
  }

  if (!decoded?.id || !mongoose.isValidObjectId(decoded.id)) {
    throw new HttpError(401, "Not authorized, token failed");
  }

  const user = await User.findById(decoded.id).select("-password");
  if (!user) throw new HttpError(401, "User not found");

  req.user = user;
  return next();
}
