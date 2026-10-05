import assert from "node:assert/strict";
import test from "node:test";
import { buildSslCommerzPayload } from "../utils/sslcommerzPayload.js";

test("SSLCommerz payload includes the SDK-required productcategory field", () => {
  const payload = buildSslCommerzPayload({
    invoice: {
      _id: "invoice-1",
      invoiceNumber: "INV-1",
      clientName: "Customer",
      clientEmail: "customer@example.com",
      currency: "BDT",
    },
    userId: "user-1",
    tranId: "txn-1",
    amountMinor: 1250,
    signature: "signature",
    baseUrl: "https://api.example.com",
  });

  assert.equal(payload.productcategory, "Service");
  assert.equal(payload.product_category, "Service");
  assert.equal(payload.total_amount, "12.50");
  assert.equal(payload.success_url, "https://api.example.com/api/payment/success");
});
