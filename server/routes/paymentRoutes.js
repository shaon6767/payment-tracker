import { Router } from "express";
import {
  initiatePayment,
  paymentCancel,
  paymentFail,
  paymentIPN,
  paymentSuccess,
} from "../controllers/paymentController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/initiate/:invoiceId", protect, initiatePayment);

// SSLCommerz redirects/IPN — no JWT
router.post("/success", paymentSuccess);
router.post("/fail", paymentFail);
router.post("/cancel", paymentCancel);
router.post("/ipn", paymentIPN);

export default router;
