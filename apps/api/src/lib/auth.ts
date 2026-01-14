import "../loadEnv.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  console.warn("JWT_SECRET not set. Auth tokens will not work until configured.");
}

export async function hashPassword(password: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export type JwtPayload = {
  userId: string;
  email: string;
  role?: string;
};

export function signToken(payload: JwtPayload) {
  if (!jwtSecret) {
    throw new Error("JWT_SECRET not configured");
  }
  return jwt.sign(payload, jwtSecret, { expiresIn: "7d" });
}

export function verifyToken(token: string) {
  if (!jwtSecret) {
    throw new Error("JWT_SECRET not configured");
  }
  return jwt.verify(token, jwtSecret) as JwtPayload;
}

export function generateVerificationToken() {
  return crypto.randomUUID();
}

export function generateRefreshToken() {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
