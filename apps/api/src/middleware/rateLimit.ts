import type { Request, Response, NextFunction } from "express";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
  keyGenerator?: (req: Request) => string;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export function createRateLimiter({ windowMs, max, keyPrefix, keyGenerator }: RateLimitOptions) {
  const hits = new Map<string, RateLimitEntry>();

  return (req: Request, res: Response, next: NextFunction) => {
    const keyBase = keyGenerator?.(req) ?? req.ip ?? "unknown";
    const key = `${keyPrefix}:${keyBase}`;
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now >= entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({ message: "Too many requests. Please try again shortly." });
    }

    entry.count += 1;
    hits.set(key, entry);
    return next();
  };
}
