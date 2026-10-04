import { HttpError } from "./httpError.js";

function parsePageValue(value, fallback, max, name) {
  if (value === undefined) return fallback;
  if (
    typeof value !== "string" ||
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) > max
  ) {
    throw new HttpError(400, `${name} must be an integer between 1 and ${max}`);
  }
  return Number(value);
}

export function parsePagination(query) {
  const unknown = Object.keys(query).find(
    (key) => key !== "page" && key !== "limit",
  );
  if (unknown) throw new HttpError(400, `Unsupported query parameter: ${unknown}`);

  const page = parsePageValue(query.page, 1, 100000, "page");
  const limit = parsePageValue(query.limit, 10, 100, "limit");
  return { page, limit, skip: (page - 1) * limit };
}
