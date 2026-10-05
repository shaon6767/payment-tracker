import cors from "cors";
import express from "express";
import helmet from "helmet";
import authRoutes from "./routes/authRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import { handleError } from "./utils/httpError.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "16kb" }));
  app.use(express.urlencoded({ extended: false, limit: "16kb" }));
  app.use("/api/auth", authRoutes);
  app.use("/api/invoices", invoiceRoutes);
  app.use("/api/payment", paymentRoutes);

  app.get("/", (req, res) =>
    res.json({ status: "ok", service: "payment-tracker" }),
  );

  app.use("/api", (req, res) => {
    res.status(404).json({ message: "API route not found" });
  });

  app.use(handleError);
  return app;
}
