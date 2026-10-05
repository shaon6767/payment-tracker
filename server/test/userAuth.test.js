import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import test from "node:test";
import { login } from "../controllers/authController.js";
import User from "../models/User.js";

test("password matching rejects users without a stored password hash", async () => {
  assert.equal(
    await User.prototype.matchPassword.call({ password: undefined }, "secret"),
    false,
  );
});

test("login rejects a user without a stored password hash", async () => {
  const originalFindOne = User.findOne;
  User.findOne = async () => ({
    matchPassword: User.prototype.matchPassword.bind({ password: undefined }),
  });

  try {
    await assert.rejects(
      login(
        { body: { email: "user@example.com", password: "provided-password" } },
        {},
      ),
      { status: 401, message: "Invalid credentials" },
    );
  } finally {
    User.findOne = originalFindOne;
  }
});

test("password matching verifies a stored password hash", async () => {
  const password = "correct horse battery staple";
  const hash = await bcrypt.hash(password, 4);

  assert.equal(
    await User.prototype.matchPassword.call({ password: hash }, password),
    true,
  );
  assert.equal(
    await User.prototype.matchPassword.call({ password: hash }, "wrong"),
    false,
  );
});
