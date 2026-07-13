# Mortda Adam — CV Site

A personal CV website with a password-protected admin panel for editing
content without touching code.

## Project layout

```
server.js              Express app: routes, sessions, security middleware
lib/store.js            Reads/writes data/content.json (atomic writes)
middleware/auth.js       requireAuth guard for /admin routes
middleware/csrf.js       CSRF token issue/verify
data/content.json        All CV content (profile, experience, publications, ...)
data/sessions/            Session store files (gitignored)
views/index.ejs           Public site
views/login.ejs           Admin login
views/admin.ejs            Admin dashboard
public/css/style.css       All styling (shared by public site + admin)
public/js/admin.js         Admin dashboard behavior (add/remove rows, save)
public/uploads/             Profile photo
scripts/hash-password.js    CLI to generate a bcrypt hash for .env
```

## Running locally

```bash
npm install
cp .env.example .env
# generate a session secret and put it in .env:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# generate your admin password hash and put it in .env:
npm run hash-password -- "a-strong-password-at-least-10-chars"
npm start
```

Visit `http://localhost:3000` for the public site and
`http://localhost:3000/admin` to log in and edit content.

**Your current admin login** (generated during setup — change it soon,
see below):
- Username: `admin`
- Password: `UVHaHVH2Sm934ZjDwP0Z`

To set your own password at any time:
```bash
npm run hash-password -- "your-new-password"
```
Then paste the printed `ADMIN_PASSWORD_HASH=...` line into `.env` and restart
the server. The plaintext password is never stored anywhere.

### Forgot your password?

There's no email-based "reset password" flow, on purpose — wiring up SMTP
just to recover one admin password would add real attack surface (an email
account to compromise, SMTP secrets to protect) for a single-admin site.
Recovery is simpler: you already have file access, so just repeat the
"set your own password" steps above (`npm run hash-password`, paste the
new hash into `.env`, restart). Whoever can edit `.env` on the server *is*
the account owner — that's the actual security boundary here, not the
login form.

If you're deployed on a host where you don't have shell/file access,
recovery means updating the `ADMIN_PASSWORD_HASH` environment variable in
that platform's dashboard instead, then redeploying/restarting.

This app is intentionally single-admin (one username/password pair in
`.env`) — there's no user registration, by design. If you ever need a
second trusted editor, the right move is a second fixed username/password
pair set up the same way, not open self-registration on a panel that edits
your public CV.

## What the admin panel can edit

Profile photo, name, title, bio, contact info, education, work experience
(with per-role bullet points and modules), publications, projects, skills,
conferences, and professional memberships — all from one form, no code
edits required.

## Security measures in place

- **Password storage**: bcrypt (cost 12), never plaintext. See `scripts/hash-password.js`.
- **Session auth**: `express-session` with `httpOnly`, `sameSite=lax` cookies,
  `secure` cookies in production, 2-hour expiry, and session regeneration on
  login (prevents session fixation).
- **CSRF protection**: synchronizer-token pattern (`middleware/csrf.js`) —
  every state-changing request must echo a per-session token back as a
  header or form field. Cookies alone don't stop CSRF; this does.
- **Brute-force protection**: `express-rate-limit` caps login attempts to
  8 per 15 minutes per IP. Failed logins return a generic error and always
  run `bcrypt.compare` (even on a bad username) so response timing can't be
  used to enumerate usernames.
- **Security headers**: `helmet` sets a strict Content-Security-Policy
  (no inline scripts/styles, no framing, no third-party origins), HSTS,
  `X-Content-Type-Options`, etc.
- **XSS**: all admin-entered content is rendered through EJS's auto-escaping
  (`<%= %>`), so stored text can never inject HTML/JS into the public page.
- **Input validation & sanitization**: `express-validator` checks the
  profile fields server-side; `sanitizeContent()` in `server.js` clamps
  string lengths and array sizes on every field before writing to disk, so
  a malicious or buggy client can't bloat or corrupt `content.json`.
- **File uploads**: photo uploads are restricted to JPEG/PNG/WebP, capped
  at 5MB, and written under a fixed filename (no path traversal via
  user-supplied names). Old photo files are cleaned up on replacement.
- **Atomic writes**: `content.json` is written to a temp file and renamed
  into place, so a crash mid-save can't corrupt or truncate it.
- **No secrets in code**: `SESSION_SECRET` and `ADMIN_PASSWORD_HASH` live
  in `.env`, which is gitignored. The server refuses to start if they're
  missing.

## Deploying online

This is a normal Node.js app — deploy it anywhere that runs Node
(Render, Railway, Fly.io, a VPS, etc.). Steps are the same everywhere:

1. Push this project to a **private** GitHub repo (don't commit `.env` —
   it's gitignored already).
2. On your hosting provider, set these environment variables (same names
   as `.env`): `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`,
   `NODE_ENV=production`. Generate a *new* `SESSION_SECRET` for production
   (don't reuse the local one).
3. Make sure the platform serves over HTTPS (all major hosts do this by
   default) — `NODE_ENV=production` makes cookies `secure`, so login
   won't work over plain HTTP.
4. If the platform's disk isn't persistent (e.g. some serverless/container
   platforms reset the filesystem on redeploy), `data/content.json` and
   `public/uploads/` need a persistent volume/disk add-on, or the content
   will reset on every deploy. Render, Railway, and a plain VPS all support
   persistent disks; check your provider's docs.
5. Deploy, then log in at `https://your-domain/admin` and change the
   password immediately (`npm run hash-password` locally, paste the new
   hash into the platform's environment variables).

I didn't deploy this for you since it needs your own hosting account and
credentials — happy to walk through a specific provider (Render, Railway,
etc.) if you tell me which one you'd like to use.
