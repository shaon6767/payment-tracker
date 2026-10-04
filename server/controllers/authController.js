import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { validateLogin, validateRegistration } from "../utils/validation.js";

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES || "7d",
  });
}

function authResponse(user) {
  return {
    token: signToken(user._id),
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
    },
  };
}

export async function register(req, res) {
  const values = validateRegistration(req.body);
  const exists = await User.findOne({ email: values.email });
  if (exists) throw new HttpError(409, "Email already registered");

  const user = await User.create(values);
  res.status(201).json(authResponse(user));
}

export async function login(req, res) {
  const { email, password } = validateLogin(req.body);
  const user = await User.findOne({ email });
  if (!user || !(await user.matchPassword(password))) {
    throw new HttpError(401, "Invalid credentials");
  }

  res.json(authResponse(user));
}

export async function me(req, res) {
  res.json({ user: req.user });
}
