import { useState } from "react";

export default function InvoiceForm({ initial, onSubmit, submitting }) {
  const [form, setForm] = useState({
    clientName: initial?.clientName || "",
    clientEmail: initial?.clientEmail || "",
    amount: initial?.amount || "",
    currency: initial?.currency || "BDT",
    description: initial?.description || "",
    dueDate: initial?.dueDate ? initial.dueDate.slice(0, 10) : "",
  });

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      amount: Number(form.amount),
      dueDate: form.dueDate || undefined,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Client Name *
          </label>
          <input
            name="clientName"
            required
            value={form.clientName}
            onChange={change}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Client Email *
          </label>
          <input
            type="email"
            name="clientEmail"
            required
            value={form.clientEmail}
            onChange={change}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Amount *</label>
          <input
            type="number"
            min="1"
            step="0.01"
            name="amount"
            required
            value={form.amount}
            onChange={change}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Currency</label>
          <select
            name="currency"
            value={form.currency}
            onChange={change}
            className="w-full px-3 py-2 border rounded"
          >
            <option>BDT</option>
            <option>USD</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Due Date</label>
          <input
            type="date"
            name="dueDate"
            value={form.dueDate}
            onChange={change}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          name="description"
          rows="3"
          value={form.description}
          onChange={change}
          className="w-full px-3 py-2 border rounded"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="px-5 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60"
      >
        {submitting ? "Saving…" : "Save Invoice"}
      </button>
    </form>
  );
}
