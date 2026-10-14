/**
 * The chat concierge (floating "Chat with us" widget, /concierge, /api/concierge) is off unless
 * CONCIERGE_ENABLED=true. It needs the tables from `npm run access:migrate -- --concierge`, which a
 * deploy never applies, so merging the code changes nothing in production until both are done.
 */
export const conciergeEnabled = (env: Record<string, string | undefined> = process.env): boolean => env.CONCIERGE_ENABLED === "true";
