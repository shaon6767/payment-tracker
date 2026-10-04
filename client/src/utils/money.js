export function formatMinorAmount(amountMinor, currency = "BDT") {
  if (
    typeof amountMinor !== "bigint" &&
    !Number.isSafeInteger(amountMinor)
  ) {
    return "—";
  }
  const minor = BigInt(amountMinor);
  const absolute = minor < 0n ? -minor : minor;
  const whole = absolute / 100n;
  const fraction = String(absolute % 100n).padStart(2, "0");
  const sign = minor < 0n ? "-" : "";
  const symbol = currency === "BDT" ? "৳" : "$";
  return `${symbol}${sign}${whole}.${fraction} ${currency}`;
}
