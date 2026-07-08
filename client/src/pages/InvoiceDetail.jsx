import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api
      .get(`/invoices/${id}`)
      .then(({ data }) => setInvoice(data))
      .catch((e) => setError(e?.response?.data?.message || "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [id]);

  const payNow = async () => {
    setError("");
    setPaying(true);
    try {
      const { data } = await api.post(`/payment/initiate/${id}`);
      if (data.gatewayUrl) {
        window.location.href = data.gatewayUrl;
      } else {
        setError("No gateway URL returned");
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Payment initiation failed");
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <div className="p-10">Loading…</div>;
  if (error) return <div className="p-10 text-red-600">{error}</div>;
  if (!invoice) return <div className="p-10">Invoice not found</div>;

  const statusColor =
    {
      paid: "bg-green-100 text-green-700",
      unpaid: "bg-amber-100 text-amber-700",
      failed: "bg-red-100 text-red-700",
      cancelled: "bg-slate-100 text-slate-700",
    }[invoice.status] || "bg-slate-100";

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Link to="/invoices" className="text-indigo-600 text-sm hover:underline">
        ← Back to invoices
      </Link>

      <div className="bg-white rounded-xl shadow border border-slate-200 p-8 mt-4">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">
              Invoice
            </div>
            <div className="text-xl font-mono font-bold">
              {invoice.invoiceNumber}
            </div>
          </div>
          <span className={`px-3 py-1 rounded text-sm ${statusColor}`}>
            {invoice.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-y-4 text-sm mb-8">
          <div>
            <div className="text-slate-500">Bill To</div>
            <div className="font-medium">{invoice.clientName}</div>
            <div className="text-slate-600">{invoice.clientEmail}</div>
          </div>
          <div>
            <div className="text-slate-500">Issued</div>
            <div>{new Date(invoice.createdAt).toLocaleDateString()}</div>
            <div className="text-slate-500 mt-2">Due</div>
            <div>
              {invoice.dueDate
                ? new Date(invoice.dueDate).toLocaleDateString()
                : "—"}
            </div>
          </div>
        </div>

        {invoice.description && (
          <div className="mb-6">
            <div className="text-slate-500 text-sm mb-1">Description</div>
            <p className="text-sm">{invoice.description}</p>
          </div>
        )}

        <div className="border-t pt-4 flex items-center justify-between">
          <span className="text-lg font-semibold">Total</span>
          <span className="text-2xl font-bold text-indigo-600">
            ৳{invoice.amount} {invoice.currency}
          </span>
        </div>

        <div className="mt-6">
          {invoice.status === "unpaid" ? (
            <button
              onClick={payNow}
              disabled={paying}
              className="w-full bg-indigo-600 text-white py-3 rounded hover:bg-indigo-700 disabled:opacity-60"
            >
              {paying ? "Redirecting to SSLCommerz…" : "Pay Now"}
            </button>
          ) : invoice.status === "paid" ? (
            <div className="text-center text-green-700 bg-green-50 p-3 rounded">
              ✓ Payment received{" "}
              {invoice.paidAt
                ? `on ${new Date(invoice.paidAt).toLocaleString()}`
                : ""}
            </div>
          ) : (
            <div className="text-center text-slate-700 bg-slate-50 p-3 rounded">
              Status: {invoice.status}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
