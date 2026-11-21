// Supabase Auth "send email" hook. Sends Pawsage sign-in codes through Brevo's API.
// On Supabase's free tier the built-in email templates can't be edited, so we
// render our own email here and include both the 6-digit code and the magic link.

const BREVO_KEY = Deno.env.get('BREVO_API_KEY') ?? '';
const HOOK_SECRET = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? '').replace(/^v1,whsec_/, '');
const SENDER = Deno.env.get('SENDER_EMAIL') ?? 'mutawakkil280@gmail.com';
const PROJECT_REF = Deno.env.get('PROJECT_REF') ?? 'rivogbfqucvmjjvtgklb';

const enc = new TextEncoder();
const b64ToBytes = (s: string): Uint8Array =>
  Uint8Array.from(atob(s), c => c.charCodeAt(0));
const bytesToB64 = (b: Uint8Array): string => {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
};

async function verifyWebhook(payload: string, headers: Headers) {
  const id = headers.get('webhook-id');
  const ts = headers.get('webhook-timestamp');
  const sigs = headers.get('webhook-signature');
  if (!id || !ts || !sigs || !HOOK_SECRET) throw new Error('missing webhook headers or secret');
  const key = await crypto.subtle.importKey('raw', b64ToBytes(HOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${id}.${ts}.${payload}`));
  const expected = bytesToB64(new Uint8Array(sig));
  if (!sigs.split(' ').some(s => s.replace(/^v1,/, '') === expected)) throw new Error('invalid webhook signature');
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('not allowed', { status: 400 });
  const payload = await req.text();
  try {
    await verifyWebhook(payload, req.headers);
  } catch (e) {
    return Response.json({ error: { message: String(e) } }, { status: 401 });
  }

  let email = '', token = '', tokenHash = '', redirectTo = '', action = '';
  try {
    const body = JSON.parse(payload);
    email = body?.user?.email ?? '';
    token = body?.email_data?.token ?? '';
    tokenHash = body?.email_data?.token_hash ?? '';
    redirectTo = body?.email_data?.redirect_to ?? '';
    action = body?.email_data?.email_action_type ?? '';
  } catch (e) {
    return Response.json({ error: { message: 'bad payload' } }, { status: 400 });
  }
  if (!email || !token) return Response.json({ error: { message: 'missing email or token' } }, { status: 400 });

  const verifyType = action === 'signup' ? 'signup' : 'magiclink';
  const link = `https://${PROJECT_REF}.supabase.co/auth/v1/verify?token=${encodeURIComponent(tokenHash)}&type=${verifyType}&redirect_to=${encodeURIComponent(redirectTo)}`;
  const html = `
  <div style="font-family:Nunito,system-ui,sans-serif;color:#3B2F5C;max-width:520px;margin:auto">
    <h1 style="font-size:28px;margin-bottom:8px">your pawsage code</h1>
    <p style="color:#6B5F8A">type this code in the app to sign in:</p>
    <div style="font-size:40px;font-weight:900;letter-spacing:10px;color:#5B4BC4;padding:16px 0">${token}</div>
    <p style="color:#6B5F8A">or tap the link on the same device:</p>
    <p><a href="${link}" style="background:#6C57E8;color:#fff;padding:14px 22px;border-radius:28px;text-decoration:none;font-weight:800">sign in</a></p>
    <p style="color:#6B5F8A;font-size:13px;margin-top:24px">if you didn't ask for this, you can ignore it.</p>
  </div>`;

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'pawsage', email: SENDER },
      to: [{ email }],
      subject: 'your pawsage code',
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    return Response.json({ error: { message: `brevo: ${await res.text()}` } }, { status: 500 });
  }
  return Response.json({});
});
