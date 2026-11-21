# Supabase email templates for code sign-in

Sign-in can use a 6-digit code **or** the magic link. Supabase only puts the code in the email if the template contains `{{ .Token }}`.

**Free tier caveat:** custom email templates require a paid plan or custom SMTP. On the default free provider the email contains only the link. That is fine — the app opens the link via PKCE and signs the reader in; the code field is kept as a fallback. The copy in `js/views/onboarding.ts` is written for both cases.

If you have templates enabled (paid plan or custom SMTP), edit **both** templates in Supabase: Authentication > Emails (Templates):

- **Magic Link** (used by people who already have an account)
- **Confirm signup** (used the first time someone signs in)

Paste this as the message body in each:

```html
<h2>your pawsage code</h2>
<p>Type this code in the app to sign in:</p>
<p style="font-size:32px;font-weight:800;letter-spacing:6px">{{ .Token }}</p>
<p>Or tap this link on the same device: <a href="{{ .ConfirmationURL }}">sign in</a></p>
<p>If you didn't ask for this, you can ignore it.</p>
```

Code length is set under Authentication > Sign In / Providers > Email (default 6). The app accepts 6 to 10 digits.
Codes expire after an hour by default and can be used once.
