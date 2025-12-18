import { Router } from "express";
import { z } from "zod";
import { comparePassword, hashPassword, signToken, generateVerificationToken } from "../lib/auth.js";
import { createUser, findUserByEmail, setVerificationToken, verifyUserEmail } from "../lib/db.js";
import { sendMail } from "../lib/mailer.ts";

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
    const token = generateVerificationToken();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
    const user = await createUser({ email, passwordHash, verificationToken: token, verificationExpires: expires });
    if (!user) {
      return res.status(500).json({ message: "Could not create user" });
    }
    const jwt = signToken({ userId: user.id, email: user.email, role: user.role });
    // Fire and forget email; if email fails we still allow soft login.
    sendMail({
      to: user.email,
      subject: "Verify your email",
      text: `Click to verify: ${process.env.WEB_BASE_URL ?? "http://localhost:3000"}/verify?token=${token}`,
    }).catch((err) => console.warn("send verification email failed", err));
    res.status(201).json({
      token: jwt,
      user: { id: user.id, email: user.email, role: user.role, emailVerified: user.email_verified ?? false },
    });
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
    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role, emailVerified: user.email_verified ?? false },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/verify", async (req, res, next) => {
  try {
    const token = z.string().parse(req.query.token);
    const verified = await verifyUserEmail(token);
    if (!verified) return res.status(400).json({ message: "Invalid or expired verification link" });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/request-verification", async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ message: "User not found" });
    const token = generateVerificationToken();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await setVerificationToken(user.id, token, expires);
    await sendMail({
      to: user.email,
      subject: "Verify your email",
      text: `Click to verify: ${process.env.WEB_BASE_URL ?? "http://localhost:3000"}/verify?token=${token}`,
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
