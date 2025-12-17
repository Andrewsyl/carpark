import { Router } from "express";
import { z } from "zod";
import { comparePassword, hashPassword, signToken } from "../lib/auth.js";
import { createUser, findUserByEmail } from "../lib/db.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

router.post("/register", async (req, res, next) => {
  try {
    const { email, password } = registerSchema.parse(req.body);
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }
    const passwordHash = await hashPassword(password);
    const user = await createUser({ email, passwordHash });
    if (!user) {
      return res.status(500).json({ message: "Could not create user" });
    }
    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (error) {
    next(error);
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (error) {
    next(error);
  }
});

export default router;
