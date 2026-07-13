const fs = require("fs");
const path = require("path");

// In production (Fly.io) DATA_DIR points at a mounted persistent volume, so
// content.json and uploaded files survive redeploys/restarts. Locally it
// defaults to the project's own data/ and public/uploads/ folders, which are
// already writable and already hold the seed content.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const UPLOADS_DIR = process.env.DATA_DIR ? path.join(DATA_DIR, "uploads") : path.join(__dirname, "..", "public", "uploads");

const SEED_CONTENT_PATH = path.join(__dirname, "..", "data", "content.json");
const SEED_UPLOADS_DIR = path.join(__dirname, "..", "public", "uploads");

const CONTENT_PATH = path.join(DATA_DIR, "content.json");
const SESSIONS_DIR = path.join(DATA_DIR, "sessions");

// On first boot against a fresh (empty) volume, copy the baseline content and
// photo that shipped in the image so the site isn't blank. After that, every
// write goes to the volume and this is a no-op (the files already exist).
function seedIfEmpty() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });

  if (!fs.existsSync(CONTENT_PATH) && fs.existsSync(SEED_CONTENT_PATH) && CONTENT_PATH !== SEED_CONTENT_PATH) {
    fs.copyFileSync(SEED_CONTENT_PATH, CONTENT_PATH);
  }

  const hasProfilePhoto = fs.existsSync(UPLOADS_DIR) && fs.readdirSync(UPLOADS_DIR).some((f) => f.startsWith("profile."));
  if (!hasProfilePhoto && UPLOADS_DIR !== SEED_UPLOADS_DIR && fs.existsSync(SEED_UPLOADS_DIR)) {
    fs.readdirSync(SEED_UPLOADS_DIR)
      .filter((f) => f.startsWith("profile."))
      .forEach((f) => fs.copyFileSync(path.join(SEED_UPLOADS_DIR, f), path.join(UPLOADS_DIR, f)));
  }
}

module.exports = { DATA_DIR, UPLOADS_DIR, CONTENT_PATH, SESSIONS_DIR, seedIfEmpty };
