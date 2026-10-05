import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { formatMinorAmount } from "../utils/money.js";

const receiptSchema = new mongoose.Schema(
  {
    tranId: { type: String, required: true },
    amountMinor: { type: Number, required: true, min: 1 },
    paidAt: { type: Date, required: true },
  },
  { _id: false },
);

const activePaymentSchema = new mongoose.Schema(
  {
    tranId: { type: String, required: true },
    amountMinor: { type: Number, required: true, min: 1 },
    expiresAt: { type: Date, required: true },
  },
  { _id: false },
);

const invoiceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    invoiceNumber: { type: String, required: true, unique: true },
    clientName: { type: String, required: true, trim: true, maxlength: 120 },
    clientEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    amountMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },
    paidAmountMinor: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isSafeInteger,
    },
    pendingAmountMinor: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isSafeInteger,
    },
    activePayment: { type: activePaymentSchema, default: null },
    payments: { type: [receiptSchema], default: [] },
    currency: { type: String, enum: ["BDT", "USD"], default: "BDT" },
    description: { type: String, default: "", maxlength: 2000 },
    status: {
      type: String,
      enum: ["unpaid", "partially_paid", "paid"],
      default: "unpaid",
    },
    paidAt: { type: Date, default: null },
    dueDate: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

invoiceSchema.index({ "activePayment.tranId": 1 });
invoiceSchema.index({ "payments.tranId": 1 });
invoiceSchema.index({ user: 1, createdAt: -1 });

invoiceSchema.virtual("amount").get(function () {
  return formatMinorAmount(this.amountMinor);
});

invoiceSchema.virtual("paidAmount").get(function () {
  return formatMinorAmount(this.paidAmountMinor);
});

invoiceSchema.virtual("remainingAmount").get(function () {
  return formatMinorAmount(this.amountMinor - this.paidAmountMinor);
});

invoiceSchema.pre("validate", function () {
  if (!this.invoiceNumber) {
    const suffix = randomBytes(6).toString("hex").toUpperCase();
    this.invoiceNumber = `INV-${Date.now()}-${suffix}`;
  }
});

const Invoice = mongoose.model("Invoice", invoiceSchema);
export default Invoice;
