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

## Deployment (live on Fly.io)

**Live site:** https://mortda-cv.fly.dev
**Admin:** https://mortda-cv.fly.dev/admin

The app runs as a Docker container on Fly.io (app name `mortda-cv`, region
`jnb` / Johannesburg — closest to Durban). Content and uploads are stored on
a mounted persistent volume (`cv_data`, 1GB, mounted at `/data` via
`DATA_DIR`), so admin edits survive redeploys and restarts — see
`lib/paths.js` for the seed-on-first-boot logic that copies the baseline
`data/content.json` and `public/uploads/profile.*` onto a fresh volume.

Fly.io config lives in `fly.toml`. Production secrets (`SESSION_SECRET`,
`ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`) are set via `fly secrets set`, not
committed to git — they're separate from the values in your local `.env`
(a fresh `SESSION_SECRET` was generated for production).

### Deploying a change

```bash
git add -A && git commit -m "..." && git push
fly deploy --app mortda-cv
```

`fly deploy` builds the Docker image from your local working directory and
ships it — it doesn't pull from GitHub automatically, so push to GitHub for
history/backup and run `fly deploy` separately to actually update the live
site.

### Useful commands

```bash
fly logs --app mortda-cv              # tail production logs
fly status --app mortda-cv            # machine/deploy status
fly ssh console --app mortda-cv       # shell into the running machine
fly secrets list --app mortda-cv      # see which secrets are set (not their values)
```

### Changing the production admin password

```bash
npm run hash-password -- "your-new-password"
fly secrets set ADMIN_PASSWORD_HASH='<the hash it prints>' --app mortda-cv
```
This triggers a new deploy automatically to apply the secret.

### If you ever move off Fly.io

The app is a normal Node.js app and will run anywhere Node runs (Render,
Railway, a VPS). The only Fly-specific pieces are `fly.toml` and the
`DATA_DIR` env var pointing at a persistent volume — set `DATA_DIR` to
wherever your new host's persistent disk is mounted, and everything else
(Dockerfile, server.js) works unchanged.
