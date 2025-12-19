import "./loadEnv.js";
import cors from "cors";
import express from "express";
import authRouter from "./routes/auth.js";
import bookingsRouter from "./routes/bookings.js";
import listingsRouter from "./routes/listings.js";
import reviewsRouter from "./routes/reviews.js";
import { z } from "zod";
import hostRouter from "./routes/host.js";
import adminRouter from "./routes/admin.js";
import paymentsRouter from "./routes/payments.js";

const app = express();
app.use(cors({ origin: process.env.WEB_BASE_URL ?? "*" }));
// Skip JSON parsing for Stripe webhook route so we can validate the raw payload.
app.use((req, res, next) => {
  if (req.originalUrl === "/api/bookings/webhook") {
    return next();
  }
  return express.json()(req, res, next);
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/listings", listingsRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/host", hostRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/admin", adminRouter);
app.use("/api", paymentsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);

  if (err instanceof z.ZodError) {
    return res.status(422).json({
      message: "Validation failed",
      errors: err.flatten().fieldErrors,
    });
  }

  if (err instanceof Error) {
    return res.status(500).json({ message: "Internal server error" });
  }

  res.status(500).json({ message: "An unexpected error occurred" });
});

const port = process.env.PORT ?? 4000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
