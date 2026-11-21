# Supabase email delivery (OTP)

Pawsage signs readers in with a **6-digit email OTP** (`signInWithOtp` + `verifyOtp(type: 'email')`). The email also contains a magic link as a fallback.

## How it is configured on the live project

Supabase's free tier does not allow editing the built-in email templates with the default email provider, so the code would never appear in the message. Instead, the project uses a **Send Email Auth Hook** that replaces built-in delivery:

- **Edge Function:** `supabase/functions/send-otp/index.ts`
  - verifies the Standard Webhooks signature from Supabase
  - renders its own HTML containing `email_data.token` (the 6-digit code) and a magic link built from `token_hash`
  - sends through the **Brevo** transactional email API
- **Hook config** (Supabase Auth): `hook_send_email_enabled = true`, URI `https://rivogbfqucvmjjvtgklb.supabase.co/functions/v1/send-otp`, secret `v1,whsec_…`
- **Supabase secrets** (set with `supabase secrets set`, never committed):
  - `BREVO_API_KEY`, `SEND_EMAIL_HOOK_SECRET`, `SENDER_EMAIL`, `PROJECT_REF`
- OTP length is 6 (`mailer_otp_length`), signups enabled, `mailer_autoconfirm = false`.

Brevo's free plan allows 300 emails/day — plenty for this app. Because the hook renders its own email, the built-in Magic Link / Confirm signup templates are irrelevant here.

## Deploying changes to the email

```bash
supabase functions deploy send-otp --no-verify-jwt
```

Secrets are already set on the project; redeploying the function does not change them. If you rotate the webhook secret, update BOTH the `hook_send_email_secrets` auth config field and the `SEND_EMAIL_HOOK_SECRET` Edge Function secret.

## Verifying delivery

```bash
# send a real OTP
curl -X POST https://rivogbfqucvmjjvtgklb.supabase.co/auth/v1/otp \
  -H "apikey: <anon key>" -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","createUser":true,"emailRedirectTo":"https://pawsagee.netlify.app/"}'

# check Brevo's log (requires the Brevo API key)
curl -H "api-key: <brevo key>" "https://api.brevo.com/v3/smtp/emails?email=you%40example.com&limit=5"
```

## Fallback if you move off the hook

If you upgrade to Supabase Pro or add custom SMTP, you can edit the built-in **Magic Link** and **Confirm signup** templates directly and include `{{ .Token }}` in both — then disable the hook. Both templates need the token because first-time users get *Confirm signup* and returning users get *Magic Link*.
