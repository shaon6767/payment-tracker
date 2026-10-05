import "dotenv/config";
import mongoose from "mongoose";

function toMinorUnits(amount) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const scaled = amount * 100;
  const rounded = Math.round(scaled);
  if (!Number.isSafeInteger(rounded) || Math.abs(scaled - rounded) > 0.000001) {
    return null;
  }
  return rounded;
}

function migrationUpdate(invoice) {
  const amountMinor = toMinorUnits(invoice.amount);
  if (
    amountMinor === null ||
    (invoice.currency && !["BDT", "USD"].includes(invoice.currency)) ||
    (invoice.status != null &&
      !["unpaid", "partially_paid", "paid"].includes(invoice.status))
  ) {
    return null;
  }

  const wasPaid = invoice.status === "paid";
  return {
    updateOne: {
      filter: { _id: invoice._id, amountMinor: { $exists: false } },
      update: {
        $set: {
          amountMinor,
          paidAmountMinor: wasPaid ? amountMinor : 0,
          pendingAmountMinor: 0,
          payments: [],
          status: wasPaid ? "paid" : "unpaid",
          paidAt: wasPaid ? invoice.paidAt || invoice.updatedAt : null,
        },
        $unset: { amount: "" },
      },
    },
  };
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI must be configured");
  const apply = process.argv.includes("--apply");

  await mongoose.connect(process.env.MONGO_URI);
  const invoices = mongoose.connection.collection("invoices");
  const filter = { amountMinor: { $exists: false }, amount: { $exists: true } };
  let invalidCount = 0;
  let count = 0;

  for await (const invoice of invoices.find(filter)) {
    count += 1;
    if (!migrationUpdate(invoice)) invalidCount += 1;
  }

  if (invalidCount) {
    throw new Error(
      `${invalidCount} invoice record(s) need manual review; no documents were changed`,
    );
  }
  if (!apply) {
    console.log(`Dry run complete: ${count} invoice(s) are ready to migrate.`);
    return;
  }

  let batch = [];
  for await (const invoice of invoices.find(filter)) {
    batch.push(migrationUpdate(invoice));
    if (batch.length === 500) {
      await invoices.bulkWrite(batch, { ordered: true });
      batch = [];
    }
  }
  if (batch.length) await invoices.bulkWrite(batch, { ordered: true });
  console.log(`Migration complete: ${count} invoice(s) converted.`);
}

main()
  .catch((error) => {
    console.error("Invoice money migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
