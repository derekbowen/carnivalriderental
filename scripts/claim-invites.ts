/**
 * Operator claim-invitation campaign (outreach). Dry run by default.
 *
 *   npm run email:claim-invites               # who would be invited, and what's missing
 *   npm run email:claim-invites -- --enqueue  # write invites to the outbox (needs BUSINESS_POSTAL_ADDRESS,
 *                                             # EMAIL_UNSUBSCRIBE_SECRET); then npm run email:dispatch
 *
 * Recipients: imported, still-unclaimed company accounts whose workbook record has a contact email.
 * One invite per company (dedupe key claim_invite:<companyId>). Suppressed addresses are skipped.
 * Sending to real operators needs EMAIL_MODE=live AND "claim-invite-v1" in EMAIL_APPROVED_CAMPAIGNS —
 * a founder decision. Until then dispatch redirects every invite to the test inbox.
 */
import fs from "node:fs";
import { databasePath, siteUrl } from "../src/lib/config";
import { emailConfig } from "../src/lib/email/config";
import { enqueue, isSuppressed, unsubscribeUrl } from "../src/lib/email/outbox";
import { claimInvite } from "../src/lib/email/templates";
import { planImport } from "../src/lib/imports/company-accounts";
import { planListings } from "../src/lib/imports/operator-listings";
import { openDb } from "../src/lib/requests/db";

export const CAMPAIGN = "claim-invite-v1";
const WORKBOOK = "imports/company-accounts/source/workbook.json";
const ACCOUNTS = "imports/company-accounts/carnivalrental-test/mapping.json";

(async () => {
  const cfg = emailConfig();
  const wb = JSON.parse(fs.readFileSync(WORKBOOK, "utf8"));
  const plan = planImport(wb);
  const rides = new Map<string, number>();
  for (const r of planListings(wb).rows) rides.set(r.metadata.companyId, (rides.get(r.metadata.companyId) ?? 0) + 1);
  const accounts: Record<string, unknown> = fs.existsSync(ACCOUNTS) ? JSON.parse(fs.readFileSync(ACCOUNTS, "utf8")).accounts : {};
  const db = openDb(databasePath());

  const withEmail = plan.eligible.filter((r) => r.privateData.contactEmail);
  const ready = withEmail.filter((r) => accounts[r.externalId]);
  const suppressed = ready.filter((r) => isSuppressed(db, r.privateData.contactEmail!));
  const recipients = ready.filter((r) => !isSuppressed(db, r.privateData.contactEmail!));
  console.log(`Campaign ${CAMPAIGN}: ${plan.eligible.length} eligible companies; ${withEmail.length} have a contact email; ${ready.length} have an account; ${suppressed.length} unsubscribed → ${recipients.length} recipients`);

  const missing = [!cfg.postalAddress && "BUSINESS_POSTAL_ADDRESS (CAN-SPAM)", !cfg.unsubscribeSecret && "EMAIL_UNSUBSCRIBE_SECRET"].filter(Boolean);
  if (!process.argv.includes("--enqueue")) {
    console.log(`DRY RUN — nothing queued.${missing.length ? ` Missing before --enqueue: ${missing.join(", ")}.` : ""}`);
    return;
  }
  if (missing.length) throw new Error(`Refusing: set ${missing.join(" and ")} first.`);

  let queued = 0;
  for (const r of recipients) {
    const to = r.privateData.contactEmail!;
    const res = enqueue(db, {
      kind: "outreach",
      template: "claim_invite",
      campaign: CAMPAIGN,
      dedupeKey: `claim_invite:${r.metadata.companyId}`,
      to,
      replyTo: cfg.replyTo,
      unsubscribeUrl: unsubscribeUrl(siteUrl(), to, cfg.unsubscribeSecret!),
      content: claimInvite({
        companyName: r.publicData.companyName,
        rideCount: rides.get(r.metadata.companyId) ?? 0,
        unsubscribeUrl: unsubscribeUrl(siteUrl(), to, cfg.unsubscribeSecret!),
        postalAddress: cfg.postalAddress!,
        replyTo: cfg.replyTo,
      }),
    });
    if (res.queued) queued++;
  }
  console.log(`Queued ${queued} new invites (${recipients.length - queued} were already queued). Mode ${cfg.mode}: ${cfg.mode === "test" ? `dispatch sends them to ${cfg.testRecipient}` : "dispatch sends only if the campaign is approved"}.`);
})().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
