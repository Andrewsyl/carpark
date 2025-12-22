import { Router } from "express";
import { z } from "zod";
import { comparePassword, hashPassword, signToken, generateVerificationToken } from "../lib/auth.js";
import { createUser, deleteUserAccount, findUserByEmail, setVerificationToken, verifyUserEmail } from "../lib/db.js";
import { sendMail } from "../lib/mailer.ts";
import { requireAuth } from "../middleware/auth.js";

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
    const verifyUrl = `${process.env.WEB_BASE_URL ?? "http://localhost:3000"}/verify?token=${token}`;
    sendMail({
      to: user.email,
      subject: "Verify your email",
      text: `Click to verify: ${verifyUrl}`,
      html: buildVerificationEmail(verifyUrl),
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
    const verifyUrl = `${process.env.WEB_BASE_URL ?? "http://localhost:3000"}/verify?token=${token}`;
    await sendMail({
      to: user.email,
      subject: "Verify your email",
      text: `Click to verify: ${verifyUrl}`,
      html: buildVerificationEmail(verifyUrl),
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// Delete current account and related data (bookings, listings). Auth required.
router.delete("/me", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const deleted = await deleteUserAccount(userId);
    if (!deleted) return res.status(404).json({ message: "User not found" });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

function buildVerificationEmail(url: string) {
  return `
  <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f8fafc; padding:24px; color:#0f172a;">
    <div style="max-width:520px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:24px; box-shadow:0 10px 30px rgba(15,23,42,0.08);">
      <div style="font-size:14px; font-weight:700; letter-spacing:0.08em; color:#0ea5e9; text-transform:uppercase;">ParkShare</div>
      <h1 style="margin:12px 0 8px; font-size:22px; color:#0f172a;">Verify your email</h1>
      <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#334155;">
        Thanks for signing up. Please confirm your email to finish creating your account.
      </p>
      <a href="${url}" style="display:inline-block; background:#0ea5e9; color:white; padding:12px 18px; border-radius:12px; text-decoration:none; font-weight:700; font-size:15px;">
        Verify email
      </a>
      <p style="margin:16px 0 0; font-size:13px; color:#64748b;">
        Or copy and paste this link into your browser:<br/>
        <span style="word-break:break-all;">${url}</span>
      </p>
    </div>
  </div>
  `;
}
