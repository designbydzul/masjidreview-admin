#!/usr/bin/env node

// One-time script: guess gender from Indonesian names using Cloudflare Workers AI
//
// Usage:
//   node scripts/backfill-gender.js              # Dry run (preview only)
//   node scripts/backfill-gender.js --apply       # Write to DB
//
// Required env vars:
//   CF_ACCOUNT_ID  - Cloudflare account ID
//   CF_API_TOKEN   - API token with D1 + Workers AI permissions

const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const API_TOKEN = process.env.CF_API_TOKEN;
const DB_ID = "379063b2-ef67-4ccd-b802-202256e3a09c";

if (!ACCOUNT_ID || !API_TOKEN) {
  console.error("Missing CF_ACCOUNT_ID or CF_API_TOKEN env vars");
  process.exit(1);
}

const D1_API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}/query`;
const AI_API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/@cf/meta/llama-3.1-8b-instruct`;

async function queryD1(sql, params = []) {
  const res = await fetch(D1_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }),
  });
  const data = await res.json();
  if (!data.success) {
    console.error("D1 error:", JSON.stringify(data.errors));
    throw new Error("D1 query failed");
  }
  return data.result[0].results;
}

async function guessGender(name) {
  const res = await fetch(AI_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content:
            "You determine gender from Indonesian names. Respond with EXACTLY one word: Laki-laki, Perempuan, or unknown. No explanation.",
        },
        {
          role: "user",
          content: `What is the gender of someone named "${name}"?`,
        },
      ],
      max_tokens: 10,
    }),
  });
  const data = await res.json();
  const answer = (data.result?.response || "").trim();

  if (answer === "Laki-laki" || answer === "Perempuan") return answer;
  // Also handle case variations
  if (answer.toLowerCase().includes("laki")) return "Laki-laki";
  if (answer.toLowerCase().includes("perempuan") || answer.toLowerCase().includes("female")) return "Perempuan";
  return null;
}

async function main() {
  const shouldApply = process.argv.includes("--apply");

  console.log(shouldApply ? "MODE: APPLY (writing to DB)" : "MODE: DRY RUN (preview only)\n");

  const users = await queryD1("SELECT id, name FROM users WHERE gender IS NULL ORDER BY name");
  console.log(`Found ${users.length} users without gender.\n`);

  if (users.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  let updated = 0;
  let skipped = 0;

  for (const user of users) {
    try {
      const gender = await guessGender(user.name);
      if (gender) {
        const tag = shouldApply ? "[WRITE]" : "[WOULD]";
        console.log(`  ${tag} ${user.name} → ${gender}`);
        if (shouldApply) {
          await queryD1("UPDATE users SET gender = ? WHERE id = ? AND gender IS NULL", [gender, user.id]);
        }
        updated++;
      } else {
        console.log(`  [SKIP]  ${user.name} → uncertain`);
        skipped++;
      }
    } catch (e) {
      console.error(`  [ERROR] ${user.name}: ${e.message}`);
      skipped++;
    }

    // Rate limit: 200ms between AI calls
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
  if (!shouldApply) console.log('\nThis was a dry run. Add --apply to write changes.');
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
