/**
 * Creates .env.local from .env.example with freshly generated development secrets.
 * Refuses to overwrite an existing .env.local. Secrets are never printed.
 */
import crypto from "node:crypto";
import fs from "node:fs";

if (fs.existsSync(".env.local")) {
  console.log(".env.local already exists — leaving it unchanged.");
  process.exit(0);
}
const rand = (n: number) => crypto.randomBytes(n).toString("base64url");
const env = fs
  .readFileSync(".env.example", "utf8")
  .replace(/^INTERNAL_PASSWORD=.*$/m, `INTERNAL_PASSWORD=${rand(18)}`)
  .replace(/^REQUEST_TOKEN_SECRET=.*$/m, `REQUEST_TOKEN_SECRET=${rand(32)}`);
fs.writeFileSync(".env.local", env, { mode: 0o600 });
console.log("Wrote .env.local with generated development secrets (see INTERNAL_USER / INTERNAL_PASSWORD there).");
