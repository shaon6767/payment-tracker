import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import { formatMinorAmount } from "../utils/money.js";

export default function PaymentResult() {
  const [params] = useSearchParams();
  const invoiceId = params.get("value_a");
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(Boolean(invoiceId));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!invoiceId) return;

    let active = true;
    api
      .get(`/invoices/${invoiceId}`)
      .then(({ data }) => {
        if (active) setInvoice(data);
      })
      .catch((err) => {
        if (active) {
          setError(err?.response?.data?.message || "Could not verify payment");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [invoiceId]);

  const confirmed = invoice && invoice.paidAmountMinor > 0;
  const title = confirmed
    ? invoice.status === "paid"
      ? "Payment Complete"
      : "Partial Payment Received"
    : invoice?.pendingAmountMinor > 0
      ? "Payment Processing"
      : "Payment Not Confirmed";
  const message = confirmed
    ? "The invoice has been updated with the verified payment."
    : invoice?.pendingAmountMinor > 0
      ? "The payment gateway has not confirmed this transaction yet. The invoice remains reserved while it is checked."
      : "No payment has been recorded for this invoice. Check the invoice status before trying again.";

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow border border-slate-200 p-8 w-full max-w-md text-center">
        <h1
          className={`text-2xl font-bold mb-2 ${
            confirmed ? "text-green-600" : "text-slate-800"
          }`}
        >
          {loading ? "Checking payment…" : error ? "Unable to verify" : title}
        </h1>
        <p className="text-slate-600 mb-4">
          {error || (loading ? "Please wait while we check the invoice." : message)}
        </p>

        {invoice && (
          <div className="bg-slate-50 rounded p-4 text-sm text-left mb-6 space-y-1">
            <div>
              <span className="text-slate-500">Invoice:</span>{" "}
              {invoice.invoiceNumber}
            </div>
            <div>
              <span className="text-slate-500">Status:</span> {invoice.status}
            </div>
            <div>
              <span className="text-slate-500">Paid:</span>{" "}
              {formatMinorAmount(invoice.paidAmountMinor, invoice.currency)}
            </div>
            <div>
              <span className="text-slate-500">Remaining:</span>{" "}
              {formatMinorAmount(
                invoice.amountMinor - invoice.paidAmountMinor,
                invoice.currency,
              )}
            </div>
          </div>
        )}

        <Link
          to={invoiceId ? `/invoices/${invoiceId}` : "/invoices"}
          className="inline-block px-5 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          {invoiceId ? "View Invoice" : "Go to Invoices"}
        </Link>
      </div>
    </div>
  );
}
