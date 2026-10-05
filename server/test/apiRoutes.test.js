import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Invoice from "../models/Invoice.js";
import User from "../models/User.js";
import { createApp } from "../app.js";

const JWT_SECRET = "route-test-secret-that-is-at-least-32-characters";
const ownerId = new mongoose.Types.ObjectId("64a000000000000000000001");
const otherOwnerId = new mongoose.Types.ObjectId("64a000000000000000000002");
const invoiceId = new mongoose.Types.ObjectId("64a000000000000000000003");

function tokenFor(id) {
  return jwt.sign({ id: id.toString() }, JWT_SECRET);
}

function createInvoice(overrides = {}) {
  return {
    _id: invoiceId,
    user: ownerId,
    invoiceNumber: "INV-TEST",
    clientName: "Test Customer",
    clientEmail: "customer@example.com",
    amountMinor: 10000,
    paidAmountMinor: 0,
    pendingAmountMinor: 0,
    activePayment: null,
    payments: [],
    currency: "BDT",
    status: "unpaid",
    paidAt: null,
    dueDate: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

test("invoice routes enforce ownership", async (t) => {
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.SSLCOMMERZ_STORE_ID = "test-store";
  process.env.SSLCOMMERZ_STORE_PASSWD = "test-password";
  process.env.SSLCOMMERZ_IS_SANDBOX = "true";

  const originalFindById = User.findById;
  const originalUserFindOne = User.findOne;
  const originalInvoiceFindOne = Invoice.findOne;
  const originalInvoiceFindOneAndUpdate = Invoice.findOneAndUpdate;
  const originalInvoiceFindOneAndDelete = Invoice.findOneAndDelete;
  const originalInvoiceExists = Invoice.exists;
  const originalInvoiceUpdateOne = Invoice.updateOne;
  const originalFetch = globalThis.fetch;
  const users = new Map([
    [ownerId.toString(), { _id: ownerId, name: "Owner", email: "owner@example.com" }],
    [
      otherOwnerId.toString(),
      {
        _id: otherOwnerId,
        name: "Other owner",
        email: "other@example.com",
      },
    ],
  ]);
  let record = createInvoice({
    pendingAmountMinor: 10000,
    activePayment: {
      tranId: "late-transaction",
      amountMinor: 10000,
      expiresAt: new Date(Date.now() - 60_000),
    },
  });

  User.findById = (id) => ({
    select: async () => users.get(id.toString()) || null,
  });
  User.findOne = async () => null;
  Invoice.findOne = async (filter) => {
    if (filter["payments.tranId"]) {
      return record.payments.some(
        (payment) => payment.tranId === filter["payments.tranId"],
      )
        ? record
        : null;
    }
    if (filter["activePayment.tranId"]) {
      return record.activePayment?.tranId === filter["activePayment.tranId"]
        ? record
        : null;
    }
    return String(filter._id) === String(record._id) &&
      String(filter.user) === String(record.user)
      ? record
      : null;
  };
  Invoice.findOneAndUpdate = async (filter, update) => {
    if (String(filter._id) !== String(record._id)) return null;
    if (filter["activePayment.tranId"]) {
      if (
        filter["activePayment.tranId"] !== record.activePayment?.tranId ||
        filter.pendingAmountMinor !== record.pendingAmountMinor ||
        filter.paidAmountMinor !== record.paidAmountMinor
      ) {
        return null;
      }
      record.paidAmountMinor += update.$inc.paidAmountMinor;
      Object.assign(record, update.$set);
      record.payments.push(update.$push.payments);
      return record;
    }
    if (
      String(filter.user) !== String(record.user) ||
      (filter.paidAmountMinor !== undefined &&
        filter.paidAmountMinor !== record.paidAmountMinor) ||
      (filter.pendingAmountMinor !== undefined &&
        filter.pendingAmountMinor !== record.pendingAmountMinor)
    ) {
      return null;
    }
    Object.assign(record, update.$set);
    return record;
  };
  Invoice.findOneAndDelete = async (filter) => {
    if (
      String(filter._id) !== String(record._id) ||
      String(filter.user) !== String(record.user) ||
      filter.paidAmountMinor !== record.paidAmountMinor ||
      filter.pendingAmountMinor !== record.pendingAmountMinor
    ) {
      return null;
    }
    return record;
  };
  Invoice.exists = async (filter) =>
    String(filter._id) === String(record._id) &&
    String(filter.user) === String(record.user);
  Invoice.updateOne = async (filter, update) => {
    if (String(filter._id) !== String(record._id)) {
      return { modifiedCount: 0 };
    }
    if (filter["activePayment.expiresAt"]) {
      if (
        String(filter.user) !== String(record.user) ||
        !record.activePayment?.expiresAt ||
        record.activePayment.expiresAt > filter["activePayment.expiresAt"].$lte
      ) {
        return { modifiedCount: 0 };
      }
    } else if (
      filter["activePayment.tranId"] !== record.activePayment?.tranId
    ) {
      return { modifiedCount: 0 };
    }
    Object.assign(record, update.$set);
    return { modifiedCount: 1 };
  };
  globalThis.fetch = async (input, options) => {
    if (!String(input).includes("validator/api/merchant-validate-serverapi.php")) {
      return originalFetch(input, options);
    }
    const signature = createHmac("sha256", JWT_SECRET)
      .update(`${invoiceId}:${ownerId}:late-transaction:10000`)
      .digest("hex");
    return {
      ok: true,
      json: async () => ({
        status: "VALID",
        tran_id: "late-transaction",
        amount: "100.00",
        currency: "BDT",
        value_a: invoiceId.toString(),
        value_b: ownerId.toString(),
        value_c: signature,
      }),
    };
  };

  t.after(() => {
    User.findById = originalFindById;
    User.findOne = originalUserFindOne;
    Invoice.findOne = originalInvoiceFindOne;
    Invoice.findOneAndUpdate = originalInvoiceFindOneAndUpdate;
    Invoice.findOneAndDelete = originalInvoiceFindOneAndDelete;
    Invoice.exists = originalInvoiceExists;
    Invoice.updateOne = originalInvoiceUpdateOne;
    globalThis.fetch = originalFetch;
  });

  const server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const request = (path, id, options = {}) =>
    fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        authorization: `Bearer ${tokenFor(id)}`,
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...options.headers,
      },
    });

  const otherOwnerResponse = await request(`/api/invoices/${invoiceId}`, otherOwnerId);
  assert.equal(otherOwnerResponse.status, 404);
});

test("invoice routes clear expired reservations before update and delete", async (t) => {
  process.env.JWT_SECRET = JWT_SECRET;
  const originalFindById = User.findById;
  const originalInvoiceFindOne = Invoice.findOne;
  const originalInvoiceFindOneAndUpdate = Invoice.findOneAndUpdate;
  const originalInvoiceFindOneAndDelete = Invoice.findOneAndDelete;
  const originalInvoiceExists = Invoice.exists;
  const originalInvoiceUpdateOne = Invoice.updateOne;
  const users = new Map([
    [ownerId.toString(), { _id: ownerId, name: "Owner", email: "owner@example.com" }],
  ]);
  let record = createInvoice({
    pendingAmountMinor: 1000,
    activePayment: {
      tranId: "expired-transaction",
      amountMinor: 1000,
      expiresAt: new Date(Date.now() - 60_000),
    },
  });
  User.findById = (id) => ({
    select: async () => users.get(id.toString()) || null,
  });
  Invoice.findOne = async (filter) =>
    String(filter._id) === String(record._id) &&
    String(filter.user) === String(record.user)
      ? record
      : null;
  Invoice.findOneAndUpdate = async (filter, update) => {
    if (
      String(filter._id) !== String(record._id) ||
      String(filter.user) !== String(record.user) ||
      filter.pendingAmountMinor !== record.pendingAmountMinor ||
      filter.paidAmountMinor !== record.paidAmountMinor
    ) {
      return null;
    }
    Object.assign(record, update.$set);
    return record;
  };
  Invoice.findOneAndDelete = async (filter) =>
    String(filter._id) === String(record._id) &&
    String(filter.user) === String(record.user) &&
    filter.pendingAmountMinor === 0 &&
    filter.paidAmountMinor === 0
      ? record
      : null;
  Invoice.exists = async () => record;
  Invoice.updateOne = async (filter, update) => {
    if (
      String(filter._id) !== String(record._id) ||
      String(filter.user) !== String(record.user) ||
      record.activePayment?.expiresAt > filter["activePayment.expiresAt"].$lte
    ) {
      return { modifiedCount: 0 };
    }
    Object.assign(record, update.$set);
    return { modifiedCount: 1 };
  };
  t.after(() => {
    User.findById = originalFindById;
    Invoice.findOne = originalInvoiceFindOne;
    Invoice.findOneAndUpdate = originalInvoiceFindOneAndUpdate;
    Invoice.findOneAndDelete = originalInvoiceFindOneAndDelete;
    Invoice.exists = originalInvoiceExists;
    Invoice.updateOne = originalInvoiceUpdateOne;
  });

  const server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const headers = {
    authorization: `Bearer ${tokenFor(ownerId)}`,
    "content-type": "application/json",
  };

  const updateResponse = await fetch(`${baseUrl}/api/invoices/${invoiceId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ amount: "120.00" }),
  });
  assert.equal(updateResponse.status, 200);
  assert.equal(record.pendingAmountMinor, 0);
  assert.equal(record.activePayment, null);
  assert.equal(record.amountMinor, 12000);

  record = createInvoice({
    pendingAmountMinor: 1000,
    activePayment: {
      tranId: "expired-delete-transaction",
      amountMinor: 1000,
      expiresAt: new Date(Date.now() - 60_000),
    },
  });
  const deleteResponse = await fetch(`${baseUrl}/api/invoices/${invoiceId}`, {
    method: "DELETE",
    headers: { authorization: headers.authorization },
  });
  assert.equal(deleteResponse.status, 200);
  assert.equal(record.pendingAmountMinor, 0);
  assert.equal(record.activePayment, null);
});

test("payment callbacks reject invalid signatures and process duplicate IPNs once", async (t) => {
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.SSLCOMMERZ_STORE_ID = "test-store";
  process.env.SSLCOMMERZ_STORE_PASSWD = "test-password";
  process.env.SSLCOMMERZ_IS_SANDBOX = "true";
  const originalFindById = User.findById;
  const originalInvoiceFindOne = Invoice.findOne;
  const originalInvoiceFindOneAndUpdate = Invoice.findOneAndUpdate;
  const originalInvoiceUpdateOne = Invoice.updateOne;
  const originalFetch = globalThis.fetch;
  let record = createInvoice({
    pendingAmountMinor: 10000,
    activePayment: {
      tranId: "late-transaction",
      amountMinor: 10000,
      expiresAt: new Date(Date.now() - 60_000),
    },
  });
  User.findById = (id) => ({
    select: async () =>
      String(id) === ownerId.toString()
        ? { _id: ownerId, name: "Owner", email: "owner@example.com" }
        : null,
  });
  Invoice.findOne = async (filter) => {
    if (filter["payments.tranId"]) {
      return record.payments.some((payment) => payment.tranId === filter["payments.tranId"])
        ? record
        : null;
    }
    if (filter["activePayment.tranId"]) {
      return record.activePayment?.tranId === filter["activePayment.tranId"]
        ? record
        : null;
    }
    return null;
  };
  Invoice.findOneAndUpdate = async (filter, update) => {
    if (
      filter["activePayment.tranId"] !== record.activePayment?.tranId ||
      filter.pendingAmountMinor !== record.pendingAmountMinor ||
      filter.paidAmountMinor !== record.paidAmountMinor
    ) {
      return null;
    }
    record.paidAmountMinor += update.$inc.paidAmountMinor;
    Object.assign(record, update.$set);
    record.payments.push(update.$push.payments);
    return record;
  };
  Invoice.updateOne = originalInvoiceUpdateOne;
  globalThis.fetch = async (input, options) => {
    if (!String(input).includes("validator/api/merchant-validate-serverapi.php")) {
      return originalFetch(input, options);
    }
    const signature = createHmac("sha256", JWT_SECRET)
      .update(`${invoiceId}:${ownerId}:late-transaction:10000`)
      .digest("hex");
    return {
      ok: true,
      json: async () => ({
        status: "VALID",
        tran_id: "late-transaction",
        amount: "100.00",
        currency: "BDT",
        value_a: invoiceId.toString(),
        value_b: ownerId.toString(),
        value_c: signature,
      }),
    };
  };
  t.after(() => {
    User.findById = originalFindById;
    Invoice.findOne = originalInvoiceFindOne;
    Invoice.findOneAndUpdate = originalInvoiceFindOneAndUpdate;
    Invoice.updateOne = originalInvoiceUpdateOne;
    globalThis.fetch = originalFetch;
  });

  const server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const callback = (signature) =>
    fetch(`${baseUrl}/api/payment/ipn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tran_id: "late-transaction",
        val_id: "validated-transaction",
        value_a: invoiceId.toString(),
        value_b: ownerId.toString(),
        value_c: signature,
      }),
    });
  const validSignature = createHmac("sha256", JWT_SECRET)
    .update(`${invoiceId}:${ownerId}:late-transaction:10000`)
    .digest("hex");
  const invalidSignatureResponse = await callback("invalid-signature");
  assert.equal(invalidSignatureResponse.status, 400);
  assert.equal(record.payments.length, 0);

  const callbackResponse = await callback(validSignature);
  assert.equal(callbackResponse.status, 200);
  assert.equal(record.paidAmountMinor, 10000);
  assert.equal(record.payments.length, 1);
  const duplicateCallbackResponse = await callback(validSignature);
  assert.equal(duplicateCallbackResponse.status, 200);
  assert.equal(record.payments.length, 1);
});

test("invoice payment initiation rejects amounts above the remaining balance", async (t) => {
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.SSLCOMMERZ_STORE_ID = "test-store";
  process.env.SSLCOMMERZ_STORE_PASSWD = "test-password";
  process.env.SSLCOMMERZ_IS_SANDBOX = "true";
  const originalFindById = User.findById;
  const originalInvoiceFindOne = Invoice.findOne;
  const originalInvoiceFindOneAndUpdate = Invoice.findOneAndUpdate;
  const users = new Map([
    [ownerId.toString(), { _id: ownerId, name: "Owner", email: "owner@example.com" }],
  ]);
  const record = createInvoice();
  User.findById = (id) => ({
    select: async () => users.get(id.toString()) || null,
  });
  Invoice.findOne = async (filter) =>
    String(filter._id) === String(record._id) &&
    String(filter.user) === String(record.user)
      ? record
      : null;
  Invoice.findOneAndUpdate = async () => null;
  t.after(() => {
    User.findById = originalFindById;
    Invoice.findOne = originalInvoiceFindOne;
    Invoice.findOneAndUpdate = originalInvoiceFindOneAndUpdate;
  });

  const server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const overLimitResponse = await fetch(
    `${baseUrl}/api/payment/initiate/${invoiceId}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${tokenFor(ownerId)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ amount: "100.01" }),
    },
  );
  assert.equal(overLimitResponse.status, 409);
  assert.equal(
    (await overLimitResponse.json()).message,
    "Payment amount exceeds the outstanding balance",
  );
});

test("login and registration routes rate-limit repeated attempts", async (t) => {
  process.env.JWT_SECRET = JWT_SECRET;
  const originalUserFindOne = User.findOne;
  User.findOne = async (query) =>
    query.email === "success@example.com"
      ? {
          _id: ownerId,
          name: "Owner",
          email: "success@example.com",
          matchPassword: async () => true,
        }
      : null;
  t.after(() => {
    User.findOne = originalUserFindOne;
  });

  const server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "success@example.com",
        password: "not-a-real-password",
      }),
    });
    assert.equal(response.status, 200);
  }
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "unknown@example.com",
        password: "not-a-real-password",
      }),
    });
    assert.equal(response.status, 401);
  }
  const loginLimitedResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "unknown@example.com",
      password: "not-a-real-password",
    }),
  });
  assert.equal(loginLimitedResponse.status, 429);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "", email: "invalid", password: "" }),
    });
    assert.equal(response.status, 400);
  }
  const registrationLimitedResponse = await fetch(
    `${baseUrl}/api/auth/register`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "", email: "invalid", password: "" }),
    },
  );
  assert.equal(registrationLimitedResponse.status, 429);
});
