import "./loadEnv.js";
import cors from "cors";
import express from "express";
import authRouter from "./routes/auth.js";
import bookingsRouter from "./routes/bookings.js";
import listingsRouter from "./routes/listings.js";
import favoritesRouter from "./routes/favorites.js";
import reviewsRouter from "./routes/reviews.js";
import { z } from "zod";
import hostRouter from "./routes/host.js";
import adminRouter from "./routes/admin.js";
import paymentsRouter from "./routes/payments.js";
import supportRouter from "./routes/support.js";
import notificationsRouter from "./routes/notifications.js";
import { processScheduledNotifications } from "./lib/notifications.js";
import { csrfProtection } from "./middleware/csrf.js";

const app = express();
// Trust proxy so req.secure works behind load balancers.
app.set("trust proxy", 1);

if (process.env.ENFORCE_HTTPS === "true" || process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (req.secure || req.headers["x-forwarded-proto"] === "https") {
      if (process.env.NODE_ENV === "production") {
        res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
      }
      return next();
    }
    const host = req.headers.host ?? "";
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  });
}
const allowedOrigins = new Set(
  [
    process.env.WEB_BASE_URL,
    "http://localhost:3000",
    "http://localhost:8081",
    "http://localhost:19006",
  ].filter(Boolean)
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error("CORS blocked"));
    },
  })
);
app.use(csrfProtection);
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
app.use("/api/favorites", favoritesRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/host", hostRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/admin", adminRouter);
app.use("/api", paymentsRouter);
app.use("/api/support", supportRouter);
app.use("/api/notifications", notificationsRouter);

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

if (process.env.NOTIFICATION_PROCESSOR_INTERVAL_MS) {
  const intervalMs = Number(process.env.NOTIFICATION_PROCESSOR_INTERVAL_MS);
  if (!Number.isNaN(intervalMs) && intervalMs > 0) {
    setInterval(() => {
      void processScheduledNotifications(50);
    }, intervalMs);
  }
}
