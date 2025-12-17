export async function sendBookingEmail({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}) {
  // Swap this stub with a real email provider (SendGrid, Resend, AWS SES, etc.)
  console.info(`[email] to=${to} subject=${subject} body=${body}`);
}
