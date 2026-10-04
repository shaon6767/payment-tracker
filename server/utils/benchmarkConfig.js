const DATABASE_NAME = "payment_tracker_benchmark";

function positiveInteger(value, fallback, max, name) {
  if (value === undefined || value === "") return fallback;
  if (!/^[1-9]\d*$/.test(value) || Number(value) > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}`);
  }
  return Number(value);
}

export function getBenchmarkConfig(env = process.env) {
  const uri = env.BENCHMARK_MONGO_URI;
  if (!uri) {
    throw new Error("Set BENCHMARK_MONGO_URI to a dedicated Atlas benchmark database");
  }

  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error("BENCHMARK_MONGO_URI is not a valid MongoDB connection URI");
  }

  if (
    parsed.protocol !== "mongodb+srv:" ||
    decodeURIComponent(parsed.pathname.slice(1)) !== DATABASE_NAME
  ) {
    throw new Error(
      `Refusing to run: BENCHMARK_MONGO_URI must be Atlas and target only ${DATABASE_NAME}`,
    );
  }

  return {
    uri,
    databaseName: DATABASE_NAME,
    invoiceCount: positiveInteger(env.BENCHMARK_INVOICE_COUNT, 2000, 10000, "BENCHMARK_INVOICE_COUNT"),
    rounds: positiveInteger(env.BENCHMARK_ROUNDS, 5, 10, "BENCHMARK_ROUNDS"),
    requestsPerRound: positiveInteger(
      env.BENCHMARK_REQUESTS_PER_ROUND,
      10,
      50,
      "BENCHMARK_REQUESTS_PER_ROUND",
    ),
    concurrency: positiveInteger(env.BENCHMARK_CONCURRENCY, 5, 10, "BENCHMARK_CONCURRENCY"),
  };
}
