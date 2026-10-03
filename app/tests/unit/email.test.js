import test from 'node:test';
import assert from 'node:assert/strict';
import { EmailNotConfiguredError, sendEmail } from '../../server/lib/email.js';

const realFetch = globalThis.fetch;
const env = { EMAIL_API_KEY: process.env.EMAIL_API_KEY, EMAIL_FROM: process.env.EMAIL_FROM };
test.afterEach(() => {
  globalThis.fetch = realFetch;
  for (const [k, v] of Object.entries(env)) v === undefined ? delete process.env[k] : (process.env[k] = v);
});

test('sendEmail posts to Resend with the key and sender', async () => {
  process.env.EMAIL_API_KEY = 're_test';
  process.env.EMAIL_FROM = 'onboarding@resend.dev';
  let call;
  globalThis.fetch = async (url, init) => {
    call = { url, init };
    return new Response(JSON.stringify({ id: 'abc' }), { status: 200 });
  };
  await sendEmail({ to: 'ana@example.com', subject: 'Hi', html: '<p>x</p>', text: 'x' });
  assert.equal(call.url, 'https://api.resend.com/emails');
  assert.equal(call.init.headers.Authorization, 'Bearer re_test');
  const body = JSON.parse(call.init.body);
  assert.deepEqual([body.from, body.to], ['onboarding@resend.dev', ['ana@example.com']]);
});

test('sendEmail fails when unconfigured or when Resend refuses', async () => {
  delete process.env.EMAIL_API_KEY;
  await assert.rejects(sendEmail({ to: 'a@b.co', subject: 's', text: 't' }), EmailNotConfiguredError);

  process.env.EMAIL_API_KEY = 're_test';
  process.env.EMAIL_FROM = 'onboarding@resend.dev';
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'only your own address' }), { status: 403 });
  await assert.rejects(sendEmail({ to: 'a@b.co', subject: 's', text: 't' }), /403.*only your own address/);
});
