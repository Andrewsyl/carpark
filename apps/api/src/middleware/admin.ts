"use strict";

import { Request, Response, NextFunction } from "express";
import { findUserById } from "../lib/db.js";

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const role = req.user?.role;
  if (role === "admin") return next();

  // If role is missing from token (older tokens), fall back to DB lookup.
  if (req.user?.userId) {
    try {
      const user = await findUserById(req.user.userId);
      if (user?.role === "admin") {
        req.user.role = "admin";
        return next();
      }
    } catch (err) {
      console.error("admin role lookup failed", err);
    }
  }

  return res.status(403).json({ message: "Admin access required" });
}
