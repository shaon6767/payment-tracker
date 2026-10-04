import "dotenv/config";
import { randomUUID } from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import invoiceRoutes from "../routes/invoiceRoutes.js";
import { protect } from "../middleware/authMiddleware.js";
import Invoice from "../models/Invoice.js";
import User from "../models/User.js";
import { handleError } from "../utils/httpError.js";
import { getBenchmarkConfig } from "../utils/benchmarkConfig.js";

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * fraction) - 1];
}

function summarize(samples, responseBytes, elapsedMs, requests) {
  return {
    requestsPerSecond: requests / (elapsedMs / 1000),
    p50Ms: percentile(samples, 0.5),
    p95Ms: percentile(samples, 0.95),
    responseBytes: Math.round(
      responseBytes.reduce((sum, bytes) => sum + bytes, 0) / responseBytes.length,
    ),
  };
}

async function seedInvoices(userId, runId, count) {
  const baseDate = Date.now();
  const batchSize = 500;

  for (let offset = 0; offset < count; offset += batchSize) {
    const batch = Array.from(
      { length: Math.min(batchSize, count - offset) },
      (_, batchIndex) => {
        const index = offset + batchIndex;
        return {
          user: userId,
          invoiceNumber: `BENCH-${runId}-${index}`,
          clientName: `Benchmark Client ${index}`,
          clientEmail: `client-${index}@example.invalid`,
          amountMinor: 12500,
          paidAmountMinor: index % 3 === 0 ? 2500 : 0,
          pendingAmountMinor: 0,
          currency: "BDT",
          description: `Synthetic benchmark invoice record ${index}`,
          status: index % 3 === 0 ? "partially_paid" : "unpaid",
          createdAt: new Date(baseDate - index * 1000),
          updatedAt: new Date(baseDate - index * 1000),
        };
      },
    );
    await Invoice.insertMany(batch, { ordered: true });
  }
}

function createBenchmarkApp() {
  const app = express();
  app.use("/api/invoices", invoiceRoutes);
  app.get("/__benchmark/unpaginated-invoices", protect, async (req, res) => {
    const items = await Invoice.find({ user: req.user._id }).sort({
      createdAt: -1,
    });
    res.json(items);
  });
  app.use(handleError);
  return app;
}

async function measureEndpoint(url, headers, requestCount, concurrency, expectedCount) {
  const latencies = [];
  const responseBytes = [];
  let nextRequest = 0;
  const start = performance.now();

  async function worker() {
    while (nextRequest < requestCount) {
      nextRequest += 1;
      const requestStart = performance.now();
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error(`Benchmark endpoint returned HTTP ${response.status}`);

      const text = await response.text();
      const body = JSON.parse(text);
      const items = Array.isArray(body) ? body : body.items;
      if (
        !Array.isArray(items) ||
        items.length !== (Array.isArray(body) ? expectedCount : Math.min(10, expectedCount))
      ) {
        throw new Error("Benchmark endpoint returned an unexpected invoice count");
      }
      if (
        !Array.isArray(body) &&
        (body.pagination?.total !== expectedCount ||
          body.summary?.total !== expectedCount)
      ) {
        throw new Error("Paginated response totals do not match the seeded invoice count");
      }

      responseBytes.push(Buffer.byteLength(text));
      latencies.push(performance.now() - requestStart);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, requestCount) }, () => worker()),
  );
  return summarize(
    latencies,
    responseBytes,
    performance.now() - start,
    requestCount,
  );
}

async function run() {
  const config = getBenchmarkConfig();
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters");
  }

  await mongoose.connect(config.uri, { serverSelectionTimeoutMS: 15000 });
  const runId = randomUUID();
  let user;
  let server;

  try {
    await Promise.all([User.init(), Invoice.init()]);
    user = await User.create({
      name: "Temporary Atlas Benchmark",
      email: `benchmark-${runId}@example.invalid`,
      password: randomUUID(),
    });
    await seedInvoices(user._id, runId, config.invoiceCount);

    const app = createBenchmarkApp();
    server = await new Promise((resolve) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });

    const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });
    const headers = { authorization: `Bearer ${token}` };
    const origin = `http://127.0.0.1:${server.address().port}`;
    const paginatedUrl = `${origin}/api/invoices?page=1&limit=10`;
    const unpaginatedUrl = `${origin}/__benchmark/unpaginated-invoices`;

    await measureEndpoint(paginatedUrl, headers, 3, 1, config.invoiceCount);
    await measureEndpoint(
      unpaginatedUrl,
      headers,
      2,
      1,
      config.invoiceCount,
    );

    const rounds = [];
    for (let index = 0; index < config.rounds; index++) {
      const paginatedFirst = index % 2 === 0;
      const endpoints = paginatedFirst
        ? [
            ["paginated", paginatedUrl],
            ["unpaginatedBaseline", unpaginatedUrl],
          ]
        : [
            ["unpaginatedBaseline", unpaginatedUrl],
            ["paginated", paginatedUrl],
          ];
      const result = {};

      for (const [name, url] of endpoints) {
        result[name] = await measureEndpoint(
          url,
          headers,
          config.requestsPerRound,
          config.concurrency,
          config.invoiceCount,
        );
      }
      rounds.push(result);
    }

    const resultFor = (key) => {
      const values = rounds.map((round) => round[key]);
      return {
        medianRequestsPerSecond: Math.round(
          percentile(values.map((value) => value.requestsPerSecond), 0.5),
        ),
        medianP50LatencyMs: Number(
          percentile(values.map((value) => value.p50Ms), 0.5).toFixed(2),
        ),
        medianP95LatencyMs: Number(
          percentile(values.map((value) => value.p95Ms), 0.5).toFixed(2),
        ),
        medianResponseBytes: Math.round(
          percentile(values.map((value) => value.responseBytes), 0.5),
        ),
      };
    };

    const paginated = resultFor("paginated");
    const unpaginatedBaseline = resultFor("unpaginatedBaseline");
    console.log(
      JSON.stringify(
        {
          benchmark: "Payment Tracker authenticated invoice listing",
          database: config.databaseName,
          atlasHost: new URL(config.uri).hostname,
          invoicesPerUser: config.invoiceCount,
          pageSize: 10,
          concurrency: config.concurrency,
          requestsPerRound: config.requestsPerRound,
          rounds: config.rounds,
          runtime: process.version,
          paginated,
          unpaginatedBaseline,
          responseSizeReductionPercent: Number(
            (
              (1 - paginated.medianResponseBytes / unpaginatedBaseline.medianResponseBytes) *
              100
            ).toFixed(1),
          ),
          note: "Median across paired repeated rounds. Local HTTP benchmark includes Atlas queries, JWT auth and JSON serialization; real values depend on Atlas tier, network and dataset.",
        },
        null,
        2,
      ),
    );
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
    if (user) {
      await Invoice.deleteMany({ user: user._id });
      await User.deleteOne({ _id: user._id });
    }
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error("Atlas invoice benchmark failed:", error.message);
    process.exitCode = 1;
  });
}
