import { getInvoiceStatus } from "./money.js";

export function outstandingAmountMinor(invoice) {
  return invoice.amountMinor - invoice.paidAmountMinor;
}

export function createPaymentReservation(invoice, amountMinor, tranId, expiresAt) {
  const outstanding = outstandingAmountMinor(invoice);
  if (invoice.status === "paid") {
    return { error: "Invoice cannot accept payments" };
  }
  if (invoice.pendingAmountMinor > 0) {
    return { error: "A payment is already in progress" };
  }
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 1) {
    return { error: "Payment amount must be positive" };
  }
  if (amountMinor > outstanding) {
    return { error: "Payment amount exceeds the outstanding balance" };
  }

  return {
    value: {
      pendingAmountMinor: amountMinor,
      activePayment: { tranId, amountMinor, expiresAt },
    },
  };
}

export function settlePayment(invoice, amountMinor, tranId, paidAt) {
  if (
    invoice.status === "paid" ||
    invoice.pendingAmountMinor !== amountMinor ||
    invoice.activePayment?.tranId !== tranId ||
    invoice.activePayment?.amountMinor !== amountMinor ||
    amountMinor > outstandingAmountMinor(invoice)
  ) {
    return null;
  }

  const paidAmountMinor = invoice.paidAmountMinor + amountMinor;
  return {
    paidAmountMinor,
    pendingAmountMinor: 0,
    activePayment: null,
    status: getInvoiceStatus(invoice.amountMinor, paidAmountMinor),
    paidAt: paidAmountMinor === invoice.amountMinor ? paidAt : invoice.paidAt,
    payment: { tranId, amountMinor, paidAt },
  };
}

export function getOwnerInvoiceFilter(userId, invoiceId) {
  return { user: userId, ...(invoiceId ? { _id: invoiceId } : {}) };
}
