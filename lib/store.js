const fs = require("fs");
const path = require("path");

const CONTENT_PATH = path.join(__dirname, "..", "data", "content.json");

function readContent() {
  const raw = fs.readFileSync(CONTENT_PATH, "utf-8");
  return JSON.parse(raw);
}

// Write to a temp file then rename, so a crash mid-write can never leave
// content.json truncated or half-written.
function writeContent(data) {
  const tmpPath = `${CONTENT_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmpPath, CONTENT_PATH);
}

module.exports = { readContent, writeContent };
