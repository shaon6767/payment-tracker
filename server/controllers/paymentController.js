import SSLCommerzPayment from "sslcommerz-lts";
import Invoice from "../models/Invoice.js";

const store_id = process.env.SSLCOMMERZ_STORE_ID;
const store_passwd = process.env.SSLCOMMERZ_STORE_PASSWD;
const isSandbox = true;

function base() {
  const p = process.env.PORT || 5000;
  // Use ngrok URL via SSL_BASE_URL env when testing IPN locally
  if (process.env.SSL_BASE_URL)
    return process.env.SSL_BASE_URL.replace(/\/$/, "");
  return `http://localhost:${p}`;
}

// POST /api/payment/initiate/:invoiceId
export async function initiatePayment(req, res) {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.invoiceId,
      user: req.user._id,
    });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    if (invoice.status === "paid")
      return res.status(400).json({ message: "Invoice already paid" });

    const tranId = `txn_${invoice._id}_${Date.now()}`;

    const data = {
      total_amount: invoice.amount,
      currency: invoice.currency || "BDT",
      tran_id: tranId,
      success_url: `${base()}/api/payment/success`,
      fail_url: `${base()}/api/payment/fail`,
      cancel_url: `${base()}/api/payment/cancel`,
      ipn_url: `${base()}/api/payment/ipn`,
      shipping_method: "No",
      product_name: invoice.invoiceNumber,
      product_category: "Service",
      product_profile: "non-physical-goods",
      cus_name: invoice.clientName,
      cus_email: invoice.clientEmail,
      cus_add1: "N/A",
      cus_city: "Dhaka",
      cus_postcode: "1000",
      cus_country: "Bangladesh",
      cus_phone: "0000000000",
      value_a: invoice._id.toString(),
      value_b: req.user._id.toString(),
    };

    const sslcz = new SSLCommerzPayment(store_id, store_passwd, isSandbox);
    const apiResp = await sslcz.init(data, false);

    if (apiResp?.status === "SUCCESS" && apiResp?.GatewayPageURL) {
      invoice.tranId = tranId;
      await invoice.save();
      return res.json({
        gatewayUrl: apiResp.GatewayPageURL,
        tranId,
        sessionId: apiResp.sessionkey,
      });
    }

    return res
      .status(400)
      .json({ message: "Failed to initiate payment", detail: apiResp });
  } catch (err) {
    console.error("initiatePayment error:", err);
    res.status(500).json({ message: err.message });
  }
}

async function validatePayment(orderParams) {
  // Build validation POST to SSLCommerz
  const search = new URLSearchParams({
    store_id,
    store_passwd,
    tran_id: orderParams.tran_id,
    val_id: orderParams.val_id,
  });

  const baseDomain = isSandbox
    ? "https://sandbox.sslcommerz.com"
    : "https://securepay.sslcommerz.com";

  const url = `${baseDomain}/validator/api/merchant-validate-serverapi.php?${search.toString()}`;
  const resp = await fetch(url);
  return await resp.json();
}

async function applyPayment(payload) {
  // payload: { status, tran_id, val_id, amount, value_a (invoiceId) }
  const invoiceId = payload.value_a || payload.valueA;
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return;

  const valid = await validatePayment(payload);

  if (
    valid?.status === "VALID" &&
    String(valid.amount) === String(invoice.amount) &&
    valid.tran_id === invoice.tranId
  ) {
    invoice.status = "paid";
    invoice.paidAt = new Date();
    await invoice.save();
  } else {
    invoice.status = "failed";
    await invoice.save();
  }
}

// POST /api/payment/success
export async function paymentSuccess(req, res) {
  try {
    await applyPayment(req.body || req.query);
  } catch (e) {
    console.error("success handler error:", e);
  }
  const q = new URLSearchParams(req.body || req.query).toString();
  res.redirect(`${process.env.CLIENT_URL}/payment/result?${q}`);
}

// POST /api/payment/fail
export async function paymentFail(req, res) {
  try {
    if (req.body?.value_a) {
      await Invoice.findByIdAndUpdate(req.body.value_a, { status: "failed" });
    }
  } catch (e) {
    console.error(e);
  }
  const q = new URLSearchParams(req.body || req.query).toString();
  res.redirect(`${process.env.CLIENT_URL}/payment/result?${q}`);
}

// POST /api/payment/cancel
export async function paymentCancel(req, res) {
  try {
    if (req.body?.value_a) {
      await Invoice.findByIdAndUpdate(req.body.value_a, {
        status: "cancelled",
      });
    }
  } catch (e) {
    console.error(e);
  }
  const q = new URLSearchParams(req.body || req.query).toString();
  res.redirect(`${process.env.CLIENT_URL}/payment/result?${q}`);
}

// POST /api/payment/ipn
export async function paymentIPN(req, res) {
  try {
    await applyPayment(req.body || req.query);
    res.status(200).send("IPN processed");
  } catch (e) {
    console.error("IPN error:", e);
    res.status(500).send("IPN error");
  }
}
