import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    invoiceNumber: { type: String, required: true, unique: true },
    clientName: { type: String, required: true, trim: true },
    clientEmail: { type: String, required: true, trim: true, lowercase: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "BDT" },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["unpaid", "paid", "cancelled", "failed"],
      default: "unpaid",
    },
    tranId: { type: String, default: null },
    paidAt: { type: Date, default: null },
    dueDate: { type: Date },
  },
  { timestamps: true },
);

invoiceSchema.pre("validate", async function (next) {
  if (this.invoiceNumber) return next();
  const count = await mongoose.models.Invoice.countDocuments();
  this.invoiceNumber = `INV-${Date.now()}-${(count + 1).toString().padStart(4, "0")}`;
  next();
});

const Invoice = mongoose.model("Invoice", invoiceSchema);
export default Invoice;
