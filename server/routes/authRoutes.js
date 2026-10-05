import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { login, me, register } from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();
const authenticationRateLimit = (skipSuccessfulRequests = false) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    message: { message: "Too many authentication attempts; try again later" },
  });

router.post("/register", authenticationRateLimit(), register);
router.post("/login", authenticationRateLimit(true), login);
router.get("/me", protect, me);

export default router;
