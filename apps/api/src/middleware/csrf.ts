import type { NextFunction, Request, Response } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function parseCookies(cookieHeader: string | undefined) {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((part) => {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) return;
    cookies[rawKey] = decodeURIComponent(rest.join("="));
  });
  return cookies;
}

function isOriginAllowed(origin: string | undefined, allowedOrigins: Set<string>) {
  if (!origin) return true;
  return allowedOrigins.has(origin);
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (process.env.CSRF_PROTECT !== "true") return next();

  const allowedOrigins = new Set(
    [process.env.WEB_BASE_URL, process.env.CSRF_ALLOWED_ORIGINS]
      .flatMap((value) => (value ? value.split(",") : []))
      .map((value) => value.trim())
      .filter(Boolean)
  );

  if (!isOriginAllowed(req.headers.origin, allowedOrigins)) {
    return res.status(403).json({ message: "CSRF blocked (origin)" });
  }

  const cookies = parseCookies(req.headers.cookie);
  if (!cookies.csrf_token) return next(); // No cookie auth in use.

  const headerToken = req.headers["x-csrf-token"] || req.headers["x-csrf"];
  if (!headerToken || headerToken !== cookies.csrf_token) {
    return res.status(403).json({ message: "CSRF blocked (token)" });
  }

  return next();
}
