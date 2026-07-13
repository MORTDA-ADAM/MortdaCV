const crypto = require("crypto");

// Synchronizer-token CSRF protection: a random token is stored in the
// session and must be echoed back (as a hidden form field or header) on
// every state-changing request. Session cookies alone don't stop CSRF
// because browsers attach cookies to cross-site requests automatically;
// this token isn't attached automatically, so a malicious site can't
// forge a valid request even if the victim is logged in.

function attachCsrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function csrfTokenIsValid(req) {
  const submitted = (req.body && req.body._csrf) || req.get("X-CSRF-Token");
  const expected = req.session.csrfToken;
  return Boolean(expected && submitted && timingSafeEqual(submitted, expected));
}

function verifyCsrfToken(req, res, next) {
  if (!csrfTokenIsValid(req)) {
    return res.status(403).json({ error: "Invalid or missing CSRF token. Please refresh and try again." });
  }
  next();
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = { attachCsrfToken, verifyCsrfToken, csrfTokenIsValid };
