export function isInvoiceOverdue(invoice, now = new Date()) {
  if (
    !invoice?.dueDate ||
    !["unpaid", "partially_paid"].includes(invoice.status)
  ) {
    return false;
  }

  const dueDate = new Date(invoice.dueDate);
  if (Number.isNaN(dueDate.getTime())) return false;

  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return dueDate.toISOString().slice(0, 10) < today;
}
