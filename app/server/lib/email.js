// Transactional email through Resend's REST API (https://resend.com/docs/api-reference/emails/send-email).
// EMAIL_API_KEY is the Resend API key; EMAIL_FROM the sender, e.g. onboarding@resend.dev
// or "LvPrime <no-reply@your-domain>". Note: with onboarding@resend.dev Resend only
// delivers to the Resend account owner's own address until a domain is verified.

const RESEND_URL = 'https://api.resend.com/emails';

export class EmailNotConfiguredError extends Error {
  constructor() {
    super('Set EMAIL_API_KEY and EMAIL_FROM to send email.');
    this.name = 'EmailNotConfiguredError';
  }
}

async function resendSend({ to, subject, html, text }) {
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new EmailNotConfiguredError();

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Resend ${res.status}: ${body.message || body.error?.message || 'send failed'}`);
  }
  return res.json().catch(() => ({}));
}

let senderImpl = resendSend;

/** Sends one email ({ to, subject, html, text }); rejects when it cannot be sent. */
export function sendEmail(message) {
  return senderImpl(message);
}

/** Test-only: replaces the Resend call; pass null to restore it. */
export function setEmailSenderForTests(fn) {
  senderImpl = fn || resendSend;
}
