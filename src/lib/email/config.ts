/**
 * Email configuration. Emailit (founder choice, 2026-10-05) sends everything Sharetribe does not
 * send itself, transactional and marketing; Resend remains as a fallback provider and still
 * receives inbound mail (MX). Sharetribe's own account emails go through its managed SendGrid.
 *
 * Safety defaults:
 * - EMAIL_MODE defaults to "test": every email, transactional or outreach, is redirected to
 *   EMAIL_TEST_RECIPIENT and the subject names the intended recipient. Nothing reaches a customer
 *   or operator until EMAIL_MODE=live is set deliberately.
 * - Outreach additionally needs its campaign listed in EMAIL_APPROVED_CAMPAIGNS (founder approval),
 *   a postal address (CAN-SPAM) and a working unsubscribe secret. Without them nothing is enqueued.
 */
export type EmailMode = "test" | "live";
export type EmailProvider = "emailit" | "resend";

export interface EmailConfig {
  mode: EmailMode;
  provider: EmailProvider;
  /** API key of the selected provider. */
  apiKey: string | null;
  fromTransactional: string;
  fromOutreach: string;
  replyTo: string;
  testRecipient: string;
  adminRecipient: string | null;
  postalAddress: string | null;
  unsubscribeSecret: string | null;
  approvedCampaigns: string[];
  /** Outreach sends per UTC day, by warm-up day number (index 0 = first day with sends). */
  warmupDailyCaps: number[];
}

const DOMAIN = "carnivalriderental.us";

export function emailConfig(env: Record<string, string | undefined> = process.env): EmailConfig {
  const list = (v?: string) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  // EMAIL_PROVIDER wins; otherwise Emailit whenever its key is present.
  const provider: EmailProvider = env.EMAIL_PROVIDER === "resend" || (env.EMAIL_PROVIDER !== "emailit" && !env.EMAILIT_API_KEY) ? "resend" : "emailit";
  return {
    mode: env.EMAIL_MODE === "live" ? "live" : "test",
    provider,
    apiKey: (provider === "emailit" ? env.EMAILIT_API_KEY : env.RESEND_API_KEY) || null,
    fromTransactional: env.EMAIL_FROM_TRANSACTIONAL || `Carnival Ride Rental <notifications@${DOMAIN}>`,
    fromOutreach: env.EMAIL_FROM_OUTREACH || `Carnival Ride Rental <hello@${DOMAIN}>`,
    replyTo: env.EMAIL_REPLY_TO || `claims@${DOMAIN}`,
    testRecipient: env.EMAIL_TEST_RECIPIENT || `qa@${DOMAIN}`,
    adminRecipient: env.EMAIL_ADMIN_RECIPIENT || null,
    postalAddress: env.BUSINESS_POSTAL_ADDRESS || null,
    unsubscribeSecret: env.EMAIL_UNSUBSCRIBE_SECRET && env.EMAIL_UNSUBSCRIBE_SECRET.length >= 16 ? env.EMAIL_UNSUBSCRIBE_SECRET : null,
    approvedCampaigns: list(env.EMAIL_APPROVED_CAMPAIGNS),
    warmupDailyCaps: [25, 50, 100, 200, 400],
  };
}
