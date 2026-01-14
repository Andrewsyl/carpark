import { Router } from "express";
import { z } from "zod";
import {
  comparePassword,
  generateRefreshToken,
  generateVerificationToken,
  hashPassword,
  hashToken,
  signToken,
} from "../lib/auth.js";
import {
  clearRefreshToken,
  createUser,
  deleteUserAccount,
  findUserByEmail,
  findUserByResetToken,
  findUserByRefreshTokenHash,
  setEmailVerified,
  setLegalAcceptance,
  setPasswordResetToken,
  setRefreshToken,
  setVerificationToken,
  updateUserPassword,
  verifyUserEmail,
} from "../lib/db.js";
import { isMailerConfigured, sendMail } from "../lib/mailer.ts";
import { requireAuth } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

const router = Router();
const loginLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5, keyPrefix: "login" });
const registerLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5, keyPrefix: "register" });
const resetLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 3, keyPrefix: "reset" });
const verifyLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 3, keyPrefix: "verify" });
const oauthLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10, keyPrefix: "oauth" });
const refreshLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 30, keyPrefix: "refresh" });

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6).max(128),
  termsVersion: z.string().trim().min(1).max(32),
  privacyVersion: z.string().trim().min(1).max(32),
});

router.post("/register", registerLimiter, async (req, res, next) => {
  try {
    const { email, password, termsVersion, privacyVersion } = registerSchema.parse(req.body);
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }
    const passwordHash = await hashPassword(password);
    const token = generateVerificationToken();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
    const user = await createUser({
      email,
      passwordHash,
      verificationToken: token,
      verificationExpires: expires,
      termsVersion,
      privacyVersion,
    });
    if (!user) {
      return res.status(500).json({ message: "Could not create user" });
    }
    const jwt = signToken({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken();
    const refreshExpires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await setRefreshToken(user.id, hashToken(refreshToken), refreshExpires);
    // Fire and forget email; if email fails we still allow soft login.
    const verifyUrl = `${process.env.WEB_BASE_URL ?? "http://localhost:3000"}/verify?token=${token}`;
    sendMail({
      to: user.email,
      subject: "Verify your email",
      text: `Click to verify: ${verifyUrl}`,
      html: buildVerificationEmail(verifyUrl),
    }).catch((err) => console.warn("send verification email failed", err));
    const previewUrl =
      process.env.NODE_ENV !== "production" || !isMailerConfigured ? verifyUrl : undefined;
    res.status(201).json({
      token: jwt,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.email_verified ?? false,
        termsVersion: user.terms_version ?? null,
        termsAcceptedAt: user.terms_accepted_at ?? null,
        privacyVersion: user.privacy_version ?? null,
        privacyAcceptedAt: user.privacy_accepted_at ?? null,
      },
      previewUrl,
    });
  } catch (error) {
    next(error);
  }
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(128),
});

router.post("/login", loginLimiter, async (req, res, next) => {
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
    const refreshToken = generateRefreshToken();
    const refreshExpires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await setRefreshToken(user.id, hashToken(refreshToken), refreshExpires);
    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.email_verified ?? false,
        termsVersion: user.terms_version ?? null,
        termsAcceptedAt: user.terms_accepted_at ?? null,
        privacyVersion: user.privacy_version ?? null,
        privacyAcceptedAt: user.privacy_accepted_at ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
});

const googleOAuthSchema = z.object({
  idToken: z.string().min(20),
});

router.post("/oauth/google", oauthLimiter, async (req, res, next) => {
  try {
    const { idToken } = googleOAuthSchema.parse(req.body);
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (!response.ok) {
      return res.status(401).json({ message: "Invalid Google token" });
    }
    const payload = (await response.json()) as {
      aud?: string;
      email?: string;
      email_verified?: string;
    };
    if (!payload.email) {
      return res.status(400).json({ message: "Google account missing email" });
    }
    const expectedAud = process.env.GOOGLE_OAUTH_CLIENT_ID;
    if (expectedAud && payload.aud !== expectedAud) {
      return res.status(401).json({ message: "Invalid Google token audience" });
    }
    let user = await findUserByEmail(payload.email);
    if (!user) {
      const passwordHash = await hashPassword(generateVerificationToken());
      user = await createUser({
        email: payload.email,
        passwordHash,
        verificationToken: null,
        verificationExpires: null,
      });
    }
    if (!user) {
      return res.status(500).json({ message: "Could not create user" });
    }
    await setEmailVerified(user.id, true);
    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken();
    const refreshExpires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await setRefreshToken(user.id, hashToken(refreshToken), refreshExpires);
    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: true,
        termsVersion: user.terms_version ?? null,
        termsAcceptedAt: user.terms_accepted_at ?? null,
        privacyVersion: user.privacy_version ?? null,
        privacyAcceptedAt: user.privacy_accepted_at ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
});

const facebookOAuthSchema = z.object({
  accessToken: z.string().min(20),
});

router.post("/oauth/facebook", oauthLimiter, async (req, res, next) => {
  try {
    const { accessToken } = facebookOAuthSchema.parse(req.body);
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appId || !appSecret) {
      return res.status(500).json({ message: "Facebook OAuth not configured" });
    }
    const debugUrl = `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(
      accessToken
    )}&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`;
    const debugRes = await fetch(debugUrl);
    if (!debugRes.ok) {
      return res.status(401).json({ message: "Invalid Facebook token" });
    }
    const debugPayload = (await debugRes.json()) as {
      data?: { is_valid?: boolean; app_id?: string };
    };
    if (!debugPayload.data?.is_valid || debugPayload.data?.app_id !== appId) {
      return res.status(401).json({ message: "Invalid Facebook token" });
    }
    const meRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(
        accessToken
      )}`
    );
    if (!meRes.ok) {
      return res.status(401).json({ message: "Facebook profile lookup failed" });
    }
    const me = (await meRes.json()) as { email?: string };
    if (!me.email) {
      return res.status(400).json({ message: "Facebook account missing email" });
    }
    let user = await findUserByEmail(me.email);
    if (!user) {
      const passwordHash = await hashPassword(generateVerificationToken());
      user = await createUser({
        email: me.email,
        passwordHash,
        verificationToken: null,
        verificationExpires: null,
      });
    }
    if (!user) {
      return res.status(500).json({ message: "Could not create user" });
    }
    await setEmailVerified(user.id, true);
    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken();
    const refreshExpires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await setRefreshToken(user.id, hashToken(refreshToken), refreshExpires);
    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: true,
        termsVersion: user.terms_version ?? null,
        termsAcceptedAt: user.terms_accepted_at ?? null,
        privacyVersion: user.privacy_version ?? null,
        privacyAcceptedAt: user.privacy_accepted_at ?? null,
      },
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

router.post("/request-verification", verifyLimiter, async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().trim().email() }).parse(req.body);
    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ message: "User not found" });
    const token = generateVerificationToken();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await setVerificationToken(user.id, token, expires);
    const verifyUrl = `${process.env.WEB_BASE_URL ?? "http://localhost:3000"}/verify?token=${token}`;
    let sent = true;
    try {
      await sendMail({
        to: user.email,
        subject: "Verify your email",
        text: `Click to verify: ${verifyUrl}`,
        html: buildVerificationEmail(verifyUrl),
      });
    } catch (err) {
      sent = false;
      console.warn("send verification email failed", err);
    }
    const previewUrl =
      process.env.NODE_ENV !== "production" || !isMailerConfigured ? verifyUrl : undefined;
    res.json({ ok: sent, previewUrl });
  } catch (error) {
    next(error);
  }
});

router.post("/request-password-reset", resetLimiter, async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().trim().email() }).parse(req.body);
    const user = await findUserByEmail(email);
    if (user) {
      const token = generateVerificationToken();
      const expires = new Date(Date.now() + 1000 * 60 * 60); // 1h
      await setPasswordResetToken(user.id, token, expires);
      const resetUrl = `${process.env.WEB_BASE_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
      sendMail({
        to: user.email,
        subject: "Reset your password",
        text: `Reset your password: ${resetUrl}`,
        html: buildPasswordResetEmail(resetUrl),
      }).catch((err) => console.warn("send reset email failed", err));
      const previewUrl =
        process.env.NODE_ENV !== "production" || !isMailerConfigured ? resetUrl : undefined;
      return res.json({ ok: true, previewUrl });
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/reset-password", async (req, res, next) => {
  try {
    const { token, password } = z
      .object({
        token: z.string().trim().min(10).max(256),
        password: z.string().min(6).max(128),
      })
      .parse(req.body);
    const user = await findUserByResetToken(token);
    if (!user) return res.status(400).json({ message: "Invalid or expired reset link" });
    const passwordHash = await hashPassword(password);
    await updateUserPassword(user.id, passwordHash);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/refresh", refreshLimiter, async (req, res, next) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string().min(20) }).parse(req.body);
    const tokenHash = hashToken(refreshToken);
    const user = await findUserByRefreshTokenHash(tokenHash);
    if (!user) return res.status(401).json({ message: "Invalid refresh token" });
    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    const nextRefreshToken = generateRefreshToken();
    const refreshExpires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await setRefreshToken(user.id, hashToken(nextRefreshToken), refreshExpires);
    res.json({
      token,
      refreshToken: nextRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.email_verified ?? false,
        termsVersion: user.terms_version ?? null,
        termsAcceptedAt: user.terms_accepted_at ?? null,
        privacyVersion: user.privacy_version ?? null,
        privacyAcceptedAt: user.privacy_accepted_at ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/legal", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const { termsVersion, privacyVersion } = z
      .object({
        termsVersion: z.string().trim().min(1).max(32).optional(),
        privacyVersion: z.string().trim().min(1).max(32).optional(),
      })
      .parse(req.body);
    const user = await setLegalAcceptance({
      userId,
      termsVersion: termsVersion ?? null,
      privacyVersion: privacyVersion ?? null,
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.email_verified ?? false,
        termsVersion: user.terms_version ?? null,
        termsAcceptedAt: user.terms_accepted_at ?? null,
        privacyVersion: user.privacy_version ?? null,
        privacyAcceptedAt: user.privacy_accepted_at ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    await clearRefreshToken(userId);
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

function buildPasswordResetEmail(url: string) {
  return `
  <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f8fafc; padding:24px; color:#0f172a;">
    <div style="max-width:520px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:24px; box-shadow:0 10px 30px rgba(15,23,42,0.08);">
      <div style="font-size:14px; font-weight:700; letter-spacing:0.08em; color:#0ea5e9; text-transform:uppercase;">ParkShare</div>
      <h1 style="margin:12px 0 8px; font-size:22px; color:#0f172a;">Reset your password</h1>
      <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#334155;">
        Click the button below to set a new password for your account. The link expires in 1 hour.
      </p>
      <a href="${url}" style="display:inline-block; background:#0ea5e9; color:white; padding:12px 18px; border-radius:12px; text-decoration:none; font-weight:700; font-size:15px;">
        Reset password
      </a>
      <p style="margin:16px 0 0; font-size:13px; color:#64748b;">
        If you didn't request this, you can ignore this email.
      </p>
    </div>
  </div>
  `;
}
