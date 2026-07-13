require("dotenv").config();

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const { body, validationResult } = require("express-validator");

const { readContent, writeContent } = require("./lib/store");
const { requireAuth } = require("./middleware/auth");
const { attachCsrfToken, verifyCsrfToken, csrfTokenIsValid } = require("./middleware/csrf");

const REQUIRED_ENV = ["SESSION_SECRET", "ADMIN_USERNAME", "ADMIN_PASSWORD_HASH"];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  console.error("Copy .env.example to .env and fill it in (see README.md).");
  process.exit(1);
}

const app = express();
const isProd = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || 3000;

if (isProd) {
  // Needed so req.secure / secure cookies work correctly behind a
  // reverse proxy (Render, Railway, Fly.io, etc. all terminate TLS in front).
  app.set("trust proxy", 1);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  })
);

app.use(express.urlencoded({ extended: false, limit: "200kb" }));
app.use(express.json({ limit: "512kb" }));

const sessionsDir = path.join(__dirname, "data", "sessions");
fs.mkdirSync(sessionsDir, { recursive: true });

app.use(
  session({
    store: new FileStore({ path: sessionsDir, logFn: () => {} }),
    name: "cv_admin_sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 2 * 60 * 60 * 1000, // 2 hours
    },
  })
);

app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));
app.use("/css", express.static(path.join(__dirname, "public", "css")));
app.use("/js", express.static(path.join(__dirname, "public", "js")));

// ---------- Public site ----------

app.get("/", (req, res) => {
  const content = readContent();
  res.render("index", { content });
});

// ---------- Admin auth ----------

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again in 15 minutes." },
});

app.get("/admin/login", attachCsrfToken, (req, res) => {
  if (req.session.isAdmin) return res.redirect("/admin");
  res.render("login", { error: null });
});

app.post("/admin/login", loginLimiter, attachCsrfToken, verifyCsrfToken, async (req, res) => {
  const { username, password } = req.body;
  const genericError = "Invalid username or password.";

  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).render("login", { error: genericError });
  }

  const usernameMatches = crypto.timingSafeEqual(
    Buffer.from(username.slice(0, 64).padEnd(64)),
    Buffer.from(process.env.ADMIN_USERNAME.slice(0, 64).padEnd(64))
  );

  // Always run bcrypt.compare, even on a bad username, so response timing
  // doesn't reveal whether the username was correct.
  const passwordMatches = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);

  if (!usernameMatches || !passwordMatches) {
    return res.status(401).render("login", { error: genericError });
  }

  // Regenerate the session on privilege change to prevent session fixation.
  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).render("login", { error: "Something went wrong. Try again." });
    }
    req.session.isAdmin = true;
    res.redirect("/admin");
  });
});

app.post("/admin/logout", requireAuth, verifyCsrfToken, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("cv_admin_sid");
    res.redirect("/admin/login");
  });
});

// ---------- Admin dashboard ----------

app.get("/admin", requireAuth, attachCsrfToken, (req, res) => {
  const content = readContent();
  res.render("admin", { content });
});

const contentValidators = [
  body("profile.name").trim().isLength({ min: 1, max: 120 }),
  body("profile.title").trim().isLength({ min: 0, max: 160 }),
  body("profile.bio").trim().isLength({ min: 0, max: 2000 }),
  body("profile.email").trim().isEmail().normalizeEmail(),
  body("profile.phone").trim().isLength({ min: 0, max: 40 }),
  body("profile.linkedin").trim().isLength({ min: 0, max: 200 }),
  body("profile.location").trim().isLength({ min: 0, max: 160 }),
];

app.post("/admin/api/content", requireAuth, verifyCsrfToken, contentValidators, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: "Validation failed", details: errors.array() });
  }

  const sanitized = sanitizeContent(req.body);
  if (!sanitized.ok) {
    return res.status(400).json({ error: sanitized.error });
  }

  const current = readContent();
  writeContent({ ...current, ...sanitized.data, profile: { ...current.profile, ...sanitized.data.profile } });

  res.json({ ok: true });
});

const photoUpload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, "public", "uploads"),
    filename: (req, file, cb) => {
      const ext = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" }[file.mimetype];
      cb(null, `profile.${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, or WebP images are allowed."));
    }
    cb(null, true);
  },
});

app.post("/admin/api/photo", requireAuth, (req, res) => {
  // multer must parse the multipart body first before req.body._csrf exists,
  // so CSRF is verified inside this callback rather than as prior middleware.
  photoUpload.single("photo")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!csrfTokenIsValid(req)) {
      return res.status(403).json({ error: "Invalid or missing CSRF token. Please refresh and try again." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const uploadsDir = path.join(__dirname, "public", "uploads");
    fs.readdirSync(uploadsDir)
      .filter((f) => f.startsWith("profile.") && f !== req.file.filename)
      .forEach((f) => fs.unlinkSync(path.join(uploadsDir, f)));

    const current = readContent();
    const publicPath = `/uploads/${req.file.filename}?v=${Date.now()}`;
    writeContent({ ...current, profile: { ...current.profile, photo: publicPath } });

    res.json({ ok: true, photo: publicPath });
  });
});

function sanitizeContent(incoming) {
  if (typeof incoming !== "object" || incoming === null) {
    return { ok: false, error: "Content must be an object." };
  }

  const asStringArray = (arr, maxLen = 60) =>
    Array.isArray(arr) ? arr.filter((s) => typeof s === "string").map((s) => s.slice(0, maxLen)).slice(0, 100) : [];

  const clamp = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");

  const data = {
    profile: {
      name: clamp(incoming.profile?.name, 120),
      title: clamp(incoming.profile?.title, 160),
      bio: clamp(incoming.profile?.bio, 2000),
      email: clamp(incoming.profile?.email, 160),
      phone: clamp(incoming.profile?.phone, 40),
      linkedin: clamp(incoming.profile?.linkedin, 200),
      location: clamp(incoming.profile?.location, 160),
    },
    education: (Array.isArray(incoming.education) ? incoming.education : []).slice(0, 30).map((e) => ({
      degree: clamp(e?.degree, 160),
      org: clamp(e?.org, 200),
      period: clamp(e?.period, 60),
    })),
    experience: (Array.isArray(incoming.experience) ? incoming.experience : []).slice(0, 40).map((e) => ({
      role: clamp(e?.role, 160),
      org: clamp(e?.org, 200),
      period: clamp(e?.period, 60),
      bullets: asStringArray(e?.bullets, 300),
      modules: asStringArray(e?.modules, 100),
    })),
    publications: (Array.isArray(incoming.publications) ? incoming.publications : []).slice(0, 60).map((p) => ({
      title: clamp(p?.title, 300),
      meta: clamp(p?.meta, 300),
      badge: clamp(p?.badge, 60),
      doiUrl: /^https?:\/\//.test(p?.doiUrl || "") ? clamp(p.doiUrl, 300) : "",
      doiLabel: clamp(p?.doiLabel, 120),
    })),
    projects: (Array.isArray(incoming.projects) ? incoming.projects : []).slice(0, 40).map((p) => ({
      title: clamp(p?.title, 160),
    })),
    skills: {
      technical: asStringArray(incoming.skills?.technical, 40),
      soft: asStringArray(incoming.skills?.soft, 40),
    },
    conferences: (Array.isArray(incoming.conferences) ? incoming.conferences : []).slice(0, 60).map((c) => ({
      name: clamp(c?.name, 160),
      year: clamp(c?.year, 20),
    })),
    professionalBody: (Array.isArray(incoming.professionalBody) ? incoming.professionalBody : []).slice(0, 20).map((b) => ({
      name: clamp(b?.name, 100),
      role: clamp(b?.role, 100),
    })),
  };

  return { ok: true, data };
}

app.use((req, res) => {
  res.status(404).send("Not found");
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("Something went wrong.");
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
