#!/usr/bin/env node
/**
 * Set or reset a user's password.
 *
 * Trackr used to accept any password for an account with no password hash.
 * That is refused now, so a database created before passwords existed cannot
 * be signed into until an operator sets one here.
 *
 *   npm run set-password -- --list
 *   npm run set-password -- alex.chen@acme.dev
 *   npm run set-password -- alex.chen@acme.dev 'a good password'
 *
 * Plain CommonJS with no build step or dev dependency, so it also runs inside
 * the production container:
 *
 *   docker exec -it trackr-app node scripts/set-password.cjs <email>
 *
 * NOTE: the hash format below is duplicated from src/lib/auth/password.ts,
 * which is the source of truth. src/lib/__tests__/password.test.ts asserts the
 * two agree, so drift fails the build rather than locking someone out.
 */
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const MIN_PASSWORD_LENGTH = 8;
const DIGEST = "sha512";
const ITERATIONS = 210000;
const KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return ["pbkdf2", DIGEST, ITERATIONS, salt.toString("base64"), derived.toString("base64")].join(
    "$"
  );
}

function generatePassword() {
  // 16 characters of base64url: nothing a shell will try to interpret.
  return crypto.randomBytes(12).toString("base64url");
}

async function list() {
  const users = await prisma.user.findMany({
    select: { email: true, name: true, passwordHash: true, authProvider: true },
    orderBy: { createdAt: "asc" },
  });

  if (users.length === 0) {
    console.log("No users exist yet. Run `npm run db:seed` to create the demo data.");
    return;
  }

  const width = Math.max(...users.map((u) => u.email.length));
  console.log("");
  console.log(`${"EMAIL".padEnd(width)}  PASSWORD  PROVIDER  NAME`);
  for (const user of users) {
    console.log(
      `${user.email.padEnd(width)}  ${user.passwordHash ? "set     " : "MISSING "}  ` +
        `${user.authProvider.padEnd(8)}  ${user.name}`
    );
  }

  const missing = users.filter((u) => !u.passwordHash).length;
  console.log("");
  if (missing > 0) {
    console.log(
      `${missing} account(s) cannot sign in with a password. Set one with:\n` +
        "  npm run set-password -- <email>"
    );
  }
}

async function setPassword(email, provided) {
  const normalized = String(email).trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    console.error(`No user found with the email address "${normalized}".`);
    console.error("Run `npm run set-password -- --list` to see the accounts that exist.");
    process.exitCode = 1;
    return;
  }

  const generated = !provided;
  const password = provided || generatePassword();

  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`The password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
    process.exitCode = 1;
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(password) },
  });

  console.log(`Password updated for ${user.name} <${user.email}>.`);
  if (generated) {
    console.log("");
    console.log(`  ${password}`);
    console.log("");
    console.log("This is shown once. Sign in with it, then change it.");
  }
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(
      [
        "Set or reset a Trackr password.",
        "",
        "  npm run set-password -- --list                show accounts and whether they have a password",
        "  npm run set-password -- <email>               set a generated password, printed once",
        "  npm run set-password -- <email> <password>    set a specific password",
      ].join("\n")
    );
    return;
  }

  if (args[0] === "--list" || args[0] === "-l") {
    await list();
    return;
  }

  await setPassword(args[0], args[1]);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

module.exports = { hashPassword };
