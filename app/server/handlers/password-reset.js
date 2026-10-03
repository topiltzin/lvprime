import { createResetToken, findAuthUserByEmail, isStrongPassword, PASSWORD_RULE_MESSAGE, readResetToken, setAuthPassword } from '../auth.js';
import { sendEmail } from '../lib/email.js';
import { readJsonBodyOr422, sendJson } from '../http.js';
import { getCustomerByAuthUserId, setMustChangePassword } from '../lib/customer-data.js';

// Customer "forgot my password" by email (specs/015 follow-up). Two public routes:
//   POST /api/password/forgot  { email }                                   -> always 200
//   POST /api/password/reset   { token, newPassword, confirmPassword }     -> 200 / 400 / 422
// The link carries a signed token valid for one hour. It also records the customer row's
// updated_at, which changes the moment the password is set, so a link works once.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COOLDOWN_MS = 60_000;
const lastSent = new Map(); // email -> timestamp; best effort per server instance

function appUrl() {
  return (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

function emailContent(link) {
  const text = `Hola,\n\nRecibimos una solicitud para restablecer tu contraseña de LvPrime. Abre este enlace para crear una nueva (vence en 1 hora):\n\n${link}\n\nSi no fuiste tú, ignora este correo: tu contraseña no cambia.`;
  const html = `<p>Hola,</p><p>Recibimos una solicitud para restablecer tu contraseña de LvPrime. Usa el botón para crear una nueva (vence en 1 hora).</p><p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;border-radius:6px;text-decoration:none">Crear nueva contraseña</a></p><p>Si el botón no funciona, copia este enlace en tu navegador:<br>${link}</p><p>Si no fuiste tú, ignora este correo: tu contraseña no cambia.</p>`;
  return { subject: 'Restablece tu contraseña de LvPrime', text, html };
}

export async function handleForgotPassword(req, res) {
  const body = await readJsonBodyOr422(req, res);
  if (body === undefined) return;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_PATTERN.test(email)) {
    return sendJson(res, 422, { error: 'validation_failed', message: 'Enter a valid email address.', fields: { email: 'Enter a valid email address.' } });
  }

  // The answer is the same whether or not the email belongs to a customer, so this
  // route cannot be used to find out who has an account.
  const reply = () => sendJson(res, 200, { ok: true });

  const now = Date.now();
  if (now - (lastSent.get(email) || 0) < COOLDOWN_MS) return reply();
  lastSent.set(email, now);

  try {
    const found = await findAuthUserByEmail(email);
    if (found.error || !found.user) return reply();
    const customer = await getCustomerByAuthUserId(found.user.id);
    // Only customers reset by email; the coach's account is managed in Supabase.
    if (!customer || customer.archived_at) return reply();

    const token = createResetToken({ uid: found.user.id, slug: customer.slug, v: customer.updated_at ?? null });
    await sendEmail({ to: found.user.email, ...emailContent(`${appUrl()}/#/reset-password?token=${encodeURIComponent(token)}`) });
  } catch (err) {
    // Never tell the caller: a failure here must look the same as "no such account".
    console.error('Password reset email failed:', err.message);
  }
  reply();
}

export async function handleResetPassword(req, res) {
  const body = await readJsonBodyOr422(req, res);
  if (body === undefined) return;
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

  const invalidLink = () =>
    sendJson(res, 400, { error: 'reset_link_invalid', message: 'This reset link is invalid or has expired. Ask for a new one.' });

  const payload = readResetToken(body.token);
  if (!payload) return invalidLink();

  const fields = {};
  if (!isStrongPassword(newPassword)) fields.newPassword = PASSWORD_RULE_MESSAGE;
  if (newPassword !== confirmPassword) fields.confirmPassword = 'The passwords do not match.';
  if (Object.keys(fields).length) {
    return sendJson(res, 422, { error: 'validation_failed', message: 'Check the highlighted fields.', fields });
  }

  const customer = await getCustomerByAuthUserId(payload.uid);
  if (!customer || customer.archived_at || customer.slug !== payload.slug || (customer.updated_at ?? null) !== payload.v) {
    return invalidLink(); // archived, or the link was already used
  }

  const updated = await setAuthPassword(payload.uid, newPassword);
  if (updated.error) {
    console.error('Password reset error:', updated.error);
    return sendJson(res, 502, { error: 'auth_unavailable', message: 'Could not change the password. Try again shortly.' });
  }
  await setMustChangePassword(customer.slug, false); // also bumps updated_at: the link is now spent
  sendJson(res, 200, { ok: true });
}
