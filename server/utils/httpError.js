export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function handleError(error, req, res, next) {
  if (res.headersSent) return next(error);

  const status =
    error.status ||
    (error.name === "ValidationError" || error.name === "CastError"
      ? 400
      : error.code === 11000
        ? 409
        : 500);

  if (status >= 500) {
    console.error("Request failed:", error);
  }

  res.status(status).json({
    message:
      status >= 500
        ? "Internal server error"
        : error.code === 11000
          ? "Email already registered"
          : error.message,
  });
}
