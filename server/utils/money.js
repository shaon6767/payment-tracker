export const SUPPORTED_CURRENCIES = new Set(["BDT", "USD"]);

export function parseAmountMinor(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;

  const text = String(value).trim();
  if (!/^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/.test(text)) return null;

  const [whole, fraction = ""] = text.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

export function formatMinorAmount(amountMinor) {
  if (
    typeof amountMinor !== "bigint" &&
    !Number.isSafeInteger(amountMinor)
  ) {
    throw new TypeError("Amount must be a safe integer number of minor units");
  }

  const minor = BigInt(amountMinor);
  const absolute = minor < 0n ? -minor : minor;
  const whole = absolute / 100n;
  const fraction = absolute % 100n;
  const sign = minor < 0n ? "-" : "";
  return `${sign}${whole}.${String(fraction).padStart(2, "0")}`;
}

export function getInvoiceStatus(amountMinor, paidAmountMinor) {
  if (paidAmountMinor >= amountMinor) return "paid";
  if (paidAmountMinor > 0) return "partially_paid";
  return "unpaid";
}
