import mongoose from "mongoose";
import Invoice from "../models/Invoice.js";
import { HttpError } from "../utils/httpError.js";
import { getOwnerInvoiceFilter } from "../utils/invoiceAccounting.js";
import { parsePagination } from "../utils/pagination.js";
import { validateInvoiceInput } from "../utils/validation.js";

function validateInvoiceId(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(400, "Invalid invoice ID");
  }
}

async function clearExpiredReservation(userId, invoiceId) {
  await Invoice.updateOne(
    {
      ...getOwnerInvoiceFilter(userId, invoiceId),
      "activePayment.expiresAt": { $lte: new Date() },
    },
    { $set: { pendingAmountMinor: 0, activePayment: null } },
  );
}

export async function listInvoices(req, res) {
  const filter = getOwnerInvoiceFilter(req.user._id);
  const { page, limit, skip } = parsePagination(req.query);
  const [items, total, [aggregate = {}]] = await Promise.all([
    Invoice.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit),
    Invoice.countDocuments(filter),
    Invoice.aggregate([
      { $match: filter },
      {
        $facet: {
          stats: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                paid: {
                  $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] },
                },
                partiallyPaid: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "partially_paid"] }, 1, 0],
                  },
                },
                unpaid: {
                  $sum: { $cond: [{ $eq: ["$status", "unpaid"] }, 1, 0] },
                },
              },
            },
          ],
          revenue: [
            {
              $group: {
                _id: "$currency",
                collectedMinor: { $sum: "$paidAmountMinor" },
              },
            },
          ],
        },
      },
    ]),
  ]);
  const stats = aggregate.stats?.[0] || {
    total: 0,
    paid: 0,
    partiallyPaid: 0,
    unpaid: 0,
  };
  const revenue = Object.fromEntries(
    (aggregate.revenue || []).map(({ _id, collectedMinor }) => [
      _id,
      collectedMinor,
    ]),
  );

  res.json({
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    summary: { ...stats, revenue },
  });
}

export async function getInvoice(req, res) {
  validateInvoiceId(req.params.id);
  const invoice = await Invoice.findOne(
    getOwnerInvoiceFilter(req.user._id, req.params.id),
  );
  if (!invoice) throw new HttpError(404, "Invoice not found");
  res.json(invoice);
}

export async function createInvoice(req, res) {
  const values = validateInvoiceInput(req.body);
  const invoice = await Invoice.create({ ...values, user: req.user._id });
  res.status(201).json(invoice);
}

export async function updateInvoice(req, res) {
  validateInvoiceId(req.params.id);
  await clearExpiredReservation(req.user._id, req.params.id);
  const updates = validateInvoiceInput(req.body, { partial: true });
  const filter = getOwnerInvoiceFilter(req.user._id, req.params.id);
  if (updates.amountMinor !== undefined || updates.currency !== undefined) {
    filter.paidAmountMinor = 0;
    filter.pendingAmountMinor = 0;
  }

  const invoice = await Invoice.findOneAndUpdate(
    filter,
    { $set: updates },
    { returnDocument: "after", runValidators: true },
  );
  if (invoice) return res.json(invoice);

  const exists = await Invoice.exists(
    getOwnerInvoiceFilter(req.user._id, req.params.id),
  );
  if (!exists) throw new HttpError(404, "Invoice not found");
  throw new HttpError(
    409,
    "Amount and currency cannot change after a payment is recorded or started",
  );
}

export async function deleteInvoice(req, res) {
  validateInvoiceId(req.params.id);
  await clearExpiredReservation(req.user._id, req.params.id);
  const filter = {
    ...getOwnerInvoiceFilter(req.user._id, req.params.id),
    paidAmountMinor: 0,
    pendingAmountMinor: 0,
  };
  const invoice = await Invoice.findOneAndDelete(filter);
  if (invoice) return res.json({ message: "Invoice deleted" });

  const exists = await Invoice.exists(
    getOwnerInvoiceFilter(req.user._id, req.params.id),
  );
  if (!exists) throw new HttpError(404, "Invoice not found");
  throw new HttpError(409, "Invoices with payment activity cannot be deleted");
}
