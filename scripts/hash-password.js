const bcrypt = require("bcryptjs");

const password = process.argv[2];

if (!password) {
  console.error("Usage: npm run hash-password -- \"your-password\"");
  process.exit(1);
}

if (password.length < 10) {
  console.error("Password too short. Use at least 10 characters.");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log("\nAdd this line to your .env file:\n");
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
