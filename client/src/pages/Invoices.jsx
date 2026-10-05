import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import InvoiceForm from "../components/InvoiceForm.jsx";
import { isInvoiceOverdue } from "../utils/invoice.js";
import { formatMinorAmount } from "../utils/money.js";

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const load = useCallback(async (pageNumber = page) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(
        `/invoices?page=${pageNumber}&limit=10`,
      );
      setInvoices(data.items);
      setPagination(data.pagination);
      return data.items;
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load invoices");
      return null;
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load(page);
  }, [load, page]);

  const create = async (payload) => {
    setSubmitting(true);
    try {
      await api.post("/invoices", payload);
      setShowForm(false);
      if (page !== 1) setPage(1);
      else await load(1);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to create invoice");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this invoice?")) return;
    try {
      await api.delete(`/invoices/${id}`);
      const updated = await load();
      if (updated?.length === 0 && page > 1) setPage(page - 1);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to delete");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          {showForm ? "Cancel" : "New Invoice"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow border border-slate-200 mb-6">
          <InvoiceForm onSubmit={create} submitting={submitting} />
        </div>
      )}

      <div className="bg-white rounded-xl shadow border border-slate-200 p-5">
        {loading ? (
          <p>Loading…</p>
        ) : error ? (
          <p className="text-red-600" role="alert">{error}</p>
        ) : invoices.length === 0 ? (
          <p className="text-slate-500 text-sm">No invoices yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2">Invoice #</th>
                  <th>Client</th>
                  <th>Email</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i._id} className="border-b">
                    <td className="py-2 font-mono text-xs">
                      {i.invoiceNumber}
                    </td>
                    <td>{i.clientName}</td>
                    <td className="text-slate-600">{i.clientEmail}</td>
                    <td>{formatMinorAmount(i.amountMinor, i.currency)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            i.status === "paid"
                              ? "bg-green-100 text-green-700"
                              : i.status === "partially_paid"
                                ? "bg-violet-100 text-violet-700"
                                : i.status === "unpaid"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {i.status}
                        </span>
                        {isInvoiceOverdue(i) && (
                          <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">
                            Overdue
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="flex gap-3">
                      <Link
                        to={`/invoices/${i._id}`}
                        className="text-indigo-600 hover:underline"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => remove(i._id)}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && pagination && pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-slate-600">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
