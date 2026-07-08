import Invoice from "../models/Invoice.js";

export async function listInvoices(req, res) {
  try {
    const filter = { user: req.user._id };
    const invoices = await Invoice.find(filter).sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export async function getInvoice(req, res) {
  try {
    const inv = await Invoice.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!inv) return res.status(404).json({ message: "Invoice not found" });
    res.json(inv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export async function createInvoice(req, res) {
  try {
    const { clientName, clientEmail, amount, currency, description, dueDate } =
      req.body;
    if (!clientName || !clientEmail || !amount) {
      return res
        .status(400)
        .json({ message: "clientName, clientEmail and amount are required" });
    }
    const inv = await Invoice.create({
      user: req.user._id,
      clientName,
      clientEmail,
      amount,
      currency: currency || "BDT",
      description: description || "",
      dueDate: dueDate || null,
    });
    res.status(201).json(inv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export async function updateInvoice(req, res) {
  try {
    const updates = (({
      clientName,
      clientEmail,
      amount,
      currency,
      description,
      dueDate,
      status,
    }) => ({
      clientName,
      clientEmail,
      amount,
      currency,
      description,
      dueDate,
      status,
    }))(req.body);

    Object.keys(updates).forEach(
      (k) => updates[k] === undefined && delete updates[k],
    );

    const inv = await Invoice.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updates,
      { new: true, runValidators: true },
    );
    if (!inv) return res.status(404).json({ message: "Invoice not found" });
    res.json(inv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export async function deleteInvoice(req, res) {
  try {
    const inv = await Invoice.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!inv) return res.status(404).json({ message: "Invoice not found" });
    res.json({ message: "Invoice deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}
