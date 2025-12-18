import "../loadEnv.js";
import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST;
const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.EMAIL_FROM ?? "no-reply@parkshare.local";

const transport =
  host && port && user && pass
    ? nodemailer.createTransport({
        host,
        port,
        auth: { user, pass },
      })
    : null;

export async function sendMail({ to, subject, text }: { to: string; subject: string; text: string }) {
  if (!transport) {
    console.warn("SMTP not configured. Email would be sent to:", to, subject, text);
    return;
  }
  await transport.sendMail({ from, to, subject, text });
}
