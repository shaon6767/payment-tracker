import { HttpError } from "./httpError.js";
import { parseAmountMinor, SUPPORTED_CURRENCIES } from "./money.js";

function requireObject(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "A JSON object is required");
  }
}

export function normalizeEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? email
    : null;
}

export function validateRegistration(body) {
  requireObject(body);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = normalizeEmail(body.email);
  const password = body.password;

  if (name.length < 1 || name.length > 80) {
    throw new HttpError(400, "Name must be between 1 and 80 characters");
  }
  if (!email) throw new HttpError(400, "A valid email is required");
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    throw new HttpError(400, "Password must be 8-72 bytes");
  }

  return { name, email, password };
}

export function validateLogin(body) {
  requireObject(body);
  const email = normalizeEmail(body.email);
  const password = body.password;

  if (!email || typeof password !== "string" || password.length === 0) {
    throw new HttpError(400, "Valid email and password are required");
  }
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new HttpError(400, "Password is too long");
  }

  return { email, password };
}

export function validatePaymentInput(body) {
  requireObject(body);
  const unsupported = Object.keys(body).find((field) => field !== "amount");
  if (unsupported) {
    throw new HttpError(400, `Unsupported payment field: ${unsupported}`);
  }

  if (body.amount === undefined) return null;
  const amountMinor = parseAmountMinor(body.amount);
  if (!amountMinor || amountMinor < 1) {
    throw new HttpError(
      400,
      "Payment amount must be positive with at most 2 decimals",
    );
  }
  return amountMinor;
}

export function validateInvoiceInput(body, { partial = false } = {}) {
  requireObject(body);
  const fields = [
    "clientName",
    "clientEmail",
    "amount",
    "currency",
    "description",
    "dueDate",
  ];
  const unknown = Object.keys(body).filter((key) => !fields.includes(key));
  if (unknown.length) {
    throw new HttpError(400, `Unsupported invoice field: ${unknown[0]}`);
  }

  if (
    !partial &&
    ["clientName", "clientEmail", "amount"].some(
      (field) => body[field] === undefined,
    )
  ) {
    throw new HttpError(
      400,
      "clientName, clientEmail and amount are required",
    );
  }

  const updates = {};
  if (body.clientName !== undefined) {
    const clientName =
      typeof body.clientName === "string" ? body.clientName.trim() : "";
    if (!clientName || clientName.length > 120) {
      throw new HttpError(400, "Client name must be 1-120 characters");
    }
    updates.clientName = clientName;
  }

  if (body.clientEmail !== undefined) {
    const clientEmail = normalizeEmail(body.clientEmail);
    if (!clientEmail) throw new HttpError(400, "A valid client email is required");
    updates.clientEmail = clientEmail;
  }

  if (body.amount !== undefined) {
    const amountMinor = parseAmountMinor(body.amount);
    if (!amountMinor || amountMinor < 1) {
      throw new HttpError(400, "Amount must be a positive value with at most 2 decimals");
    }
    updates.amountMinor = amountMinor;
  }

  if (body.currency !== undefined) {
    const currency =
      typeof body.currency === "string" ? body.currency.toUpperCase() : "";
    if (!SUPPORTED_CURRENCIES.has(currency)) {
      throw new HttpError(400, "Currency must be BDT or USD");
    }
    updates.currency = currency;
  }

  if (body.description !== undefined) {
    if (
      typeof body.description !== "string" ||
      body.description.length > 2000
    ) {
      throw new HttpError(400, "Description must be at most 2000 characters");
    }
    updates.description = body.description.trim();
  }

  if (body.dueDate !== undefined) {
    if (body.dueDate === null || body.dueDate === "") {
      updates.dueDate = null;
    } else {
      if (
        typeof body.dueDate !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)
      ) {
        throw new HttpError(400, "Due date must use YYYY-MM-DD format");
      }
      const dueDate = new Date(`${body.dueDate}T00:00:00.000Z`);
      if (
        Number.isNaN(dueDate.getTime()) ||
        dueDate.toISOString().slice(0, 10) !== body.dueDate
      ) {
        throw new HttpError(400, "Due date is invalid");
      }
      updates.dueDate = dueDate;
    }
  }

  if (!partial && body.currency === undefined) updates.currency = "BDT";
  if (!partial && body.description === undefined) updates.description = "";
  if (!partial && body.dueDate === undefined) updates.dueDate = null;
  if (partial && Object.keys(updates).length === 0) {
    throw new HttpError(400, "At least one editable field is required");
  }

  return updates;
}
