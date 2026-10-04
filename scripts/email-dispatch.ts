/**
 * Send queued emails from the outbox via Resend.
 *
 *   npm run email:dispatch                # send up to 100 pending emails (EMAIL_MODE=test by default)
 *   npm run email:dispatch -- --limit 10
 *   npm run email:dispatch -- --status    # counts only, sends nothing
 *
 * In test mode every email goes to EMAIL_TEST_RECIPIENT with the intended recipient in the subject.
 * Outreach additionally needs an approved campaign (live mode) and respects the warm-up daily cap.
 */
import { emailConfig } from "../src/lib/email/config";
import { dispatchOutbox, resendSender } from "../src/lib/email/outbox";
import { databasePath } from "../src/lib/config";
import { openDb } from "../src/lib/requests/db";

const argv = process.argv.slice(2);
const opt = (n: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

(async () => {
  const cfg = emailConfig();
  const db = openDb(databasePath());
  const counts = db.prepare(`SELECT kind, status, COUNT(*) AS n FROM email_outbox GROUP BY kind, status ORDER BY kind, status`).all() as { kind: string; status: string; n: number }[];
  console.log(`Mode: ${cfg.mode}${cfg.mode === "test" ? ` (all mail → ${cfg.testRecipient})` : ""}; approved campaigns: ${cfg.approvedCampaigns.join(", ") || "none"}`);
  for (const c of counts) console.log(`  ${c.kind.padEnd(14)} ${c.status.padEnd(11)} ${c.n}`);
  if (argv.includes("--status")) return;
  if (!cfg.apiKey) throw new Error("RESEND_API_KEY is not set");
  const r = await dispatchOutbox(db, { send: resendSender(cfg.apiKey), config: cfg, limit: Number(opt("limit") ?? 100), pauseMs: 600 });
  console.log(`Dispatched: sent ${r.sent}, failed ${r.failed}, suppressed ${r.suppressed}, blocked ${r.blocked}, deferred (warm-up cap) ${r.deferred}`);
  if (r.failed) process.exit(1);
})().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
