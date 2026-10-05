import assert from "node:assert/strict";
import test from "node:test";
import { isInvoiceOverdue } from "./invoice.js";

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
