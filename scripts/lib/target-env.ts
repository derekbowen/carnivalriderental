/**
 * Environment selection for every Sharetribe script. Import this FIRST.
 *
 * Test credentials keep their usual names (SHARETRIBE_CLIENT_ID, SHARETRIBE_INTEGRATION_CLIENT_ID,
 * SHARETRIBE_INTEGRATION_CLIENT_SECRET). Live credentials live next to them in .env.local under
 * SHARETRIBE_LIVE_* names, so nobody has to swap values by hand. With `--target live` this module
 * points the standard names at the Live values for this process only; without it, nothing changes.
 * The scripts' own guards (marketplace name checks, --confirm-live, --founder-go) still apply.
 */
const i = process.argv.indexOf("--target");
export const TARGET: "test" | "live" = i >= 0 && process.argv[i + 1] === "live" ? "live" : "test";

const LIVE_NAMES: Record<string, string> = {
  SHARETRIBE_CLIENT_ID: "SHARETRIBE_LIVE_CLIENT_ID",
  SHARETRIBE_INTEGRATION_CLIENT_ID: "SHARETRIBE_LIVE_INTEGRATION_CLIENT_ID",
  SHARETRIBE_INTEGRATION_CLIENT_SECRET: "SHARETRIBE_LIVE_INTEGRATION_CLIENT_SECRET",
};

if (TARGET === "live") {
  const missing = Object.values(LIVE_NAMES).filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`--target live needs ${missing.join(", ")} in .env.local (Console → Live environment → Build → Advanced → Applications).`);
    process.exit(1);
  }
  for (const [std, live] of Object.entries(LIVE_NAMES)) process.env[std] = process.env[live];
  if (process.env.SHARETRIBE_LIVE_MARKETPLACE_URL) process.env.SHARETRIBE_MARKETPLACE_URL = process.env.SHARETRIBE_LIVE_MARKETPLACE_URL;
}
