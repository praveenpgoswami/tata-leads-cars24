/**
 * Prints a bcrypt hash for ADMIN_PASSWORD_HASH.
 *
 * Usage: `npm run hash-password -- "your-password"`
 * Notes: Prints the raw hash (for the Vercel dashboard) and a $-escaped copy for
 * .env.local, because Next.js expands "$" in .env files.
 */
import bcrypt from "bcryptjs";
import { BCRYPT_COST } from "../lib/auth/password";
import { PASSWORD_MIN_LENGTH } from "../lib/validation/api-schemas";

function main(): void {
  const plain = process.argv[2];
  if (!plain) {
    console.error('Usage: npm run hash-password -- "your-password"');
    process.exit(1);
  }
  if (plain.length < PASSWORD_MIN_LENGTH) {
    console.error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
    process.exit(1);
  }
  const hash = bcrypt.hashSync(plain, BCRYPT_COST);
  console.log("Vercel dashboard value (paste as-is):");
  console.log(hash);
  console.log("");
  console.log(".env.local value (every $ escaped):");
  console.log(`ADMIN_PASSWORD_HASH=${hash.replace(/\$/g, "\\$")}`);
}

main();
