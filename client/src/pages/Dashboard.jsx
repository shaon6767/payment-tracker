import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";

export default function Dashboard() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/invoices")
      .then(({ data }) => setInvoices(data))
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total: invoices.length,
    paid: invoices.filter((i) => i.status === "paid").length,
    unpaid: invoices.filter((i) => i.status === "unpaid").length,
    revenue: invoices
      .filter((i) => i.status === "paid")
      .reduce((s, i) => s + i.amount, 0),
  };

  const cards = [
    { label: "Total Invoices", value: stats.total, color: "bg-blue-700" },
    { label: "Paid", value: stats.paid, color: "bg-green-700" },
    { label: "Unpaid", value: stats.unpaid, color: "bg-amber-700" },
    { label: "Revenue", value: `৳${stats.revenue}`, color: "bg-indigo-500" },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link
          to="/invoices"
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Manage Invoices
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <div
            key={c.label}
            className="bg-white p-5 rounded-xl shadow border border-slate-200"
          >
            <div
              className={`inline-block px-2 py-1 rounded text-white text-xs ${c.color}`}
            >
              {c.label}
            </div>
            <div className="text-2xl font-bold mt-3">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow border border-slate-200 p-5">
        <h2 className="font-semibold mb-3">Recent Invoices</h2>
        {loading ? (
          <p>Loading…</p>
        ) : invoices.length === 0 ? (
          <p className="text-slate-500 text-sm">
            No invoices yet. Create your first one.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2">Invoice #</th>
                  <th>Client</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.slice(0, 5).map((i) => (
                  <tr key={i._id} className="border-b">
                    <td className="py-2 font-mono text-xs">
                      {i.invoiceNumber}
                    </td>
                    <td>{i.clientName}</td>
                    <td>৳{i.amount}</td>
                    <td>
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          i.status === "paid"
                            ? "bg-green-100 text-green-700"
                            : i.status === "unpaid"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {i.status}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/invoices/${i._id}`}
                        className="text-indigo-600 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
