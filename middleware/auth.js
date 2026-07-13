function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  if (req.accepts("html")) {
    return res.redirect("/admin/login");
  }
  return res.status(401).json({ error: "Not authenticated" });
}

module.exports = { requireAuth };
