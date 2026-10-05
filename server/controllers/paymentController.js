import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";
import SSLCommerzPayment from "sslcommerz-lts";
import Invoice from "../models/Invoice.js";
import {
  createPaymentReservation,
  getOwnerInvoiceFilter,
  settlePayment,
} from "../utils/invoiceAccounting.js";
import { HttpError } from "../utils/httpError.js";
import { parseAmountMinor } from "../utils/money.js";
import { isSslCommerzLive } from "../utils/sslcommerzConfig.js";
import { buildSslCommerzPayload } from "../utils/sslcommerzPayload.js";
import { validatePaymentInput } from "../utils/validation.js";

const PAYMENT_RESERVATION_MS = 30 * 60 * 1000;

function gatewayCredentials() {
  const storeId = process.env.SSLCOMMERZ_STORE_ID;
  const storePassword = process.env.SSLCOMMERZ_STORE_PASSWD;
  if (
    !storeId ||
    !storePassword ||
    storeId.startsWith("your-") ||
    storePassword.startsWith("your-")
  ) {
    throw new HttpError(503, "Payment gateway is not configured");
  }
  return { storeId, storePassword };
}

function callbackPayload(req) {
  const values = { ...req.query, ...(req.body || {}) };
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => typeof value === "string"),
  );
}

function paymentSignature(invoice, tranId, amountMinor) {
  return createHmac("sha256", process.env.JWT_SECRET)
    .update(
      `${invoice._id}:${invoice.user}:${tranId}:${amountMinor}`,
    )
    .digest("hex");
}

function hasValidPaymentSignature(payload, invoice) {
  if (typeof payload.value_c !== "string") return false;
  const expected = Buffer.from(
    paymentSignature(
      invoice,
      invoice.activePayment.tranId,
      invoice.activePayment.amountMinor,
    ),
    "hex",
  );
  const provided = Buffer.from(payload.value_c, "hex");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

async function releaseCallbackReservation(payload) {
  const tranId = payload.tran_id?.trim();
  if (!tranId) return;
  const invoice = await Invoice.findOne({ "activePayment.tranId": tranId });
  if (
    !invoice ||
    payload.value_a !== invoice._id.toString() ||
    payload.value_b !== invoice.user.toString() ||
    !hasValidPaymentSignature(payload, invoice)
  ) {
    return;
  }

  await Invoice.updateOne(
    {
      _id: invoice._id,
      "activePayment.tranId": tranId,
      pendingAmountMinor: invoice.activePayment.amountMinor,
    },
    { $set: { pendingAmountMinor: 0, activePayment: null } },
  );
}

function paymentBaseUrl() {
  if (process.env.SSL_BASE_URL) {
    return process.env.SSL_BASE_URL.replace(/\/$/, "");
  }
  const port = process.env.PORT || 5000;
  return `http://localhost:${port}`;
}

function gatewayFailureReason(response) {
  if (response instanceof Error) return response.message.slice(0, 300);

  for (const key of ["failedreason", "failed_reason", "error", "message"]) {
    if (typeof response?.[key] === "string" && response[key].trim()) {
      return response[key].trim().slice(0, 300);
    }
  }

  return null;
}

function redirectToResult(res, status, invoiceId) {
  const query = new URLSearchParams({ status });
  if (invoiceId && mongoose.isValidObjectId(invoiceId)) {
    query.set("value_a", String(invoiceId));
  }
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  res.redirect(`${clientUrl}/payment/result?${query.toString()}`);
}

async function clearExpiredReservation(invoice, userId) {
  if (
    !invoice.activePayment?.tranId ||
    invoice.activePayment.expiresAt > new Date()
  ) {
    return invoice;
  }

  await Invoice.updateOne(
    {
      _id: invoice._id,
      user: userId,
      "activePayment.tranId": invoice.activePayment.tranId,
      "activePayment.expiresAt": { $lte: new Date() },
    },
    {
      $set: { pendingAmountMinor: 0, activePayment: null },
    },
  );
  return Invoice.findOne(getOwnerInvoiceFilter(userId, invoice._id));
}

async function releaseReservation(invoiceId, tranId) {
  await Invoice.updateOne(
    { _id: invoiceId, "activePayment.tranId": tranId },
    { $set: { pendingAmountMinor: 0, activePayment: null } },
  );
}

export async function initiatePayment(req, res) {
  if (!mongoose.isValidObjectId(req.params.invoiceId)) {
    throw new HttpError(400, "Invalid invoice ID");
  }

  let invoice = await Invoice.findOne(
    getOwnerInvoiceFilter(req.user._id, req.params.invoiceId),
  );
  if (!invoice) throw new HttpError(404, "Invoice not found");
  invoice = await clearExpiredReservation(invoice, req.user._id);
  if (!invoice) throw new HttpError(404, "Invoice not found");

  const requestedAmountMinor = validatePaymentInput(req.body || {});
  const amountMinor =
    requestedAmountMinor ?? invoice.amountMinor - invoice.paidAmountMinor;
  if (!amountMinor || amountMinor < 1) {
    throw new HttpError(400, "Payment amount must be positive with at most 2 decimals");
  }

  const tranId = `txn_${randomUUID()}`;
  const expiresAt = new Date(Date.now() + PAYMENT_RESERVATION_MS);
  const reservation = createPaymentReservation(
    invoice,
    amountMinor,
    tranId,
    expiresAt,
  );
  if (reservation.error) throw new HttpError(409, reservation.error);

  const reservedInvoice = await Invoice.findOneAndUpdate(
    {
      _id: invoice._id,
      user: req.user._id,
      amountMinor: invoice.amountMinor,
      paidAmountMinor: invoice.paidAmountMinor,
      pendingAmountMinor: 0,
      status: { $in: ["unpaid", "partially_paid"] },
    },
    { $set: reservation.value },
    { returnDocument: "after" },
  );
  if (!reservedInvoice) {
    throw new HttpError(409, "Invoice changed; refresh and try again");
  }

  try {
    const { storeId, storePassword } = gatewayCredentials();
    const sslcz = new SSLCommerzPayment(
      storeId,
      storePassword,
      isSslCommerzLive(process.env.SSLCOMMERZ_IS_SANDBOX),
    );
    const data = buildSslCommerzPayload({
      invoice,
      userId: req.user._id,
      tranId,
      amountMinor,
      signature: paymentSignature(invoice, tranId, amountMinor),
      baseUrl: paymentBaseUrl(),
    });

    const response = await sslcz.init(data, false);
    if (response?.status !== "SUCCESS" || !response?.GatewayPageURL) {
      await releaseReservation(invoice._id, tranId);
      console.error("SSLCommerz session initialization failed:", {
        status: response?.status || null,
        reason: gatewayFailureReason(response),
      });
      throw new HttpError(502, "Payment gateway could not start the session");
    }

    return res.json({
      gatewayUrl: response.GatewayPageURL,
      tranId,
      sessionId: response.sessionkey,
    });
  } catch (error) {
    await releaseReservation(invoice._id, tranId);
    throw error;
  }
}

async function validatePayment(payload) {
  if (!payload.tran_id || !payload.val_id) return null;
  const { storeId, storePassword } = gatewayCredentials();
  const query = new URLSearchParams({
    store_id: storeId,
    store_passwd: storePassword,
    tran_id: payload.tran_id,
    val_id: payload.val_id,
  });
  const domain =
    process.env.SSLCOMMERZ_IS_SANDBOX === "false"
      ? "https://securepay.sslcommerz.com"
      : "https://sandbox.sslcommerz.com";
  const response = await fetch(
    `${domain}/validator/api/merchant-validate-serverapi.php?${query}`,
    { signal: AbortSignal.timeout(10000) },
  );
  if (!response.ok) throw new HttpError(502, "Payment validation service failed");
  return response.json();
}

async function applyPayment(payload) {
  const tranId = payload.tran_id?.trim();
  if (!tranId) return { ok: false };

  const priorPayment = await Invoice.findOne({ "payments.tranId": tranId });
  if (priorPayment) {
    return {
      ok: true,
      invoiceId: priorPayment._id,
      status: priorPayment.status,
    };
  }

  const invoice = await Invoice.findOne({ "activePayment.tranId": tranId });
  if (!invoice) return { ok: false };
  if (
    payload.value_a !== invoice._id.toString() ||
    payload.value_b !== invoice.user.toString() ||
    !hasValidPaymentSignature(payload, invoice)
  ) {
    return { ok: false };
  }

  const verified = await validatePayment(payload);
  const verifiedAmount = parseAmountMinor(verified?.amount);
  if (
    !["VALID", "VALIDATED"].includes(verified?.status) ||
    verified.tran_id !== tranId ||
    verifiedAmount !== invoice.activePayment.amountMinor ||
    String(verified.currency || "").toUpperCase() !== invoice.currency ||
    verified.value_a !== invoice._id.toString() ||
    verified.value_b !== invoice.user.toString() ||
    verified.value_c !== paymentSignature(
      invoice,
      tranId,
      invoice.activePayment.amountMinor,
    )
  ) {
    return { ok: false };
  }

  const paidAt = new Date();
  const settlement = settlePayment(
    invoice,
    invoice.activePayment.amountMinor,
    tranId,
    paidAt,
  );
  if (!settlement) return { ok: false };

  const updated = await Invoice.findOneAndUpdate(
    {
      _id: invoice._id,
      user: invoice.user,
      "activePayment.tranId": tranId,
      "activePayment.amountMinor": settlement.payment.amountMinor,
      pendingAmountMinor: settlement.payment.amountMinor,
      paidAmountMinor: invoice.paidAmountMinor,
      amountMinor: invoice.amountMinor,
    },
    {
      $inc: { paidAmountMinor: settlement.payment.amountMinor },
      $set: {
        pendingAmountMinor: 0,
        activePayment: null,
        status: settlement.status,
        paidAt: settlement.paidAt,
      },
      $push: { payments: settlement.payment },
    },
    { returnDocument: "after" },
  );

  if (!updated) return { ok: false };
  return { ok: true, invoiceId: updated._id, status: updated.status };
}

export async function paymentSuccess(req, res) {
  const payload = callbackPayload(req);
  const result = await applyPayment(payload);
  redirectToResult(
    res,
    result.ok ? "confirmed" : "unconfirmed",
    result.invoiceId || payload.value_a,
  );
}

export async function paymentFail(req, res) {
  const payload = callbackPayload(req);
  await releaseCallbackReservation(payload);
  redirectToResult(res, "failed", payload.value_a);
}

export async function paymentCancel(req, res) {
  const payload = callbackPayload(req);
  await releaseCallbackReservation(payload);
  redirectToResult(res, "cancelled", payload.value_a);
}

export async function paymentIPN(req, res) {
  const result = await applyPayment(callbackPayload(req));
  if (!result.ok) throw new HttpError(400, "Payment could not be verified");
  res.status(200).send("IPN processed");
}
