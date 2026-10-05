import assert from "node:assert/strict";
import test from "node:test";
import { isInvoiceOverdue } from "../../client/src/utils/invoice.js";
import {
  createPaymentReservation,
  settlePayment,
} from "../utils/invoiceAccounting.js";
import { formatMinorAmount, parseAmountMinor } from "../utils/money.js";
import { parsePagination } from "../utils/pagination.js";
import {
  validateInvoiceInput,
  validatePaymentInput,
  validateRegistration,
} from "../utils/validation.js";

const now = new Date("2026-01-01T00:00:00.000Z");

function invoice(overrides = {}) {
  return {
    _id: "invoice-1",
    user: "owner-1",
    amountMinor: 10000,
    paidAmountMinor: 0,
    pendingAmountMinor: 0,
    activePayment: null,
    status: "unpaid",
    paidAt: null,
    ...overrides,
  };
}

test("parses decimal money as exact minor units", () => {
  assert.equal(parseAmountMinor("125.30"), 12530);
  assert.equal(parseAmountMinor(0.1), 10);
  assert.equal(parseAmountMinor("999999999999.99"), 99999999999999);
});

test("rejects invalid or over-precise money values", () => {
  for (const value of ["-1.00", "0.001", "1e3", "01.00", "", NaN, null]) {
    assert.equal(parseAmountMinor(value), null);
  }
});

test("formats integer and bigint minor-unit amounts without float arithmetic", () => {
  assert.equal(formatMinorAmount(12345), "123.45");
  assert.equal(formatMinorAmount(100n), "1.00");
  assert.equal(formatMinorAmount(9999999999999999n), "99999999999999.99");
});

test("pagination applies safe defaults and caps page size", () => {
  assert.deepEqual(parsePagination({}), { page: 1, limit: 10, skip: 0 });
  assert.deepEqual(parsePagination({ page: "3", limit: "25" }), {
    page: 3,
    limit: 25,
    skip: 50,
  });
});

test("pagination rejects malformed, excessive, and unknown query values", () => {
  for (const query of [
    { page: "0" },
    { page: "1.5" },
    { limit: "101" },
    { page: ["1", "2"] },
    { offset: "5" },
  ]) {
    assert.throws(() => parsePagination(query), { status: 400 });
  }
});

test("overdue invoices are unpaid past their calendar due date", () => {
  const now = new Date(2026, 0, 2, 12);
  assert.equal(
    isInvoiceOverdue(
      { dueDate: "2026-01-01T00:00:00.000Z", status: "unpaid" },
      now,
    ),
    true,
  );
  assert.equal(
    isInvoiceOverdue(
      { dueDate: "2026-01-02T00:00:00.000Z", status: "partially_paid" },
      now,
    ),
    false,
  );
  assert.equal(
    isInvoiceOverdue(
      { dueDate: "2026-01-01T00:00:00.000Z", status: "paid" },
      now,
    ),
    false,
  );
});

test("payment reservation prevents amounts above the outstanding balance", () => {
  assert.deepEqual(
    createPaymentReservation(invoice(), 2500, "txn-1", now).value,
    {
      pendingAmountMinor: 2500,
      activePayment: {
        tranId: "txn-1",
        amountMinor: 2500,
        expiresAt: now,
      },
    },
  );
  assert.equal(
    createPaymentReservation(invoice(), 10001, "txn-2", now).error,
    "Payment amount exceeds the outstanding balance",
  );
});

test("only one payment may be reserved per invoice at a time", () => {
  const current = invoice({
    pendingAmountMinor: 2500,
    activePayment: { tranId: "txn-1", amountMinor: 2500 },
  });
  assert.equal(
    createPaymentReservation(current, 1000, "txn-2", now).error,
    "A payment is already in progress",
  );
});

test("partial and final settlements maintain exact totals and statuses", () => {
  const firstReservation = createPaymentReservation(
    invoice(),
    3250,
    "txn-1",
    now,
  ).value;
  const firstSettlement = settlePayment(
    invoice(firstReservation),
    3250,
    "txn-1",
    now,
  );
  assert.equal(firstSettlement.paidAmountMinor, 3250);
  assert.equal(firstSettlement.pendingAmountMinor, 0);
  assert.equal(firstSettlement.status, "partially_paid");
  assert.equal(firstSettlement.paidAt, null);

  const partialInvoice = invoice({
    paidAmountMinor: firstSettlement.paidAmountMinor,
    status: firstSettlement.status,
  });
  const finalReservation = createPaymentReservation(
    partialInvoice,
    6750,
    "txn-2",
    now,
  ).value;
  const finalSettlement = settlePayment(
    invoice({ ...partialInvoice, ...finalReservation }),
    6750,
    "txn-2",
    now,
  );
  assert.equal(finalSettlement.paidAmountMinor, 10000);
  assert.equal(finalSettlement.status, "paid");
  assert.equal(finalSettlement.paidAt, now);
});

test("settlement rejects mismatched transactions and invalid API input", () => {
  const pendingInvoice = invoice({
    pendingAmountMinor: 2000,
    activePayment: { tranId: "txn-1", amountMinor: 2000 },
  });
  assert.equal(settlePayment(pendingInvoice, 2000, "txn-other", now), null);
  assert.equal(
    createPaymentReservation(
      invoice({ status: "cancelled" }),
      1000,
      "txn-cancelled",
      now,
    ).error,
    "Invoice cannot accept payments",
  );
  assert.equal(
    settlePayment(
      invoice({
        status: "cancelled",
        pendingAmountMinor: 1000,
        activePayment: { tranId: "txn-cancelled", amountMinor: 1000 },
      }),
      1000,
      "txn-cancelled",
      now,
    ),
    null,
  );
  assert.throws(
    () => validatePaymentInput({ amount: "1.001" }),
    { status: 400 },
  );
  assert.throws(
    () => validateInvoiceInput({ amount: "10.00", status: "paid" }, { partial: true }),
    { status: 400 },
  );
  assert.throws(
    () => validateRegistration({ name: "User", email: "bad", password: "123456" }),
    { status: 400 },
  );
});
