import { checkBotId } from "botid/server";

/**
 * Vercel BotID on the public form endpoints (event request, checkout, lost link). It only runs on Vercel:
 * the check needs the platform's OIDC token, and local or CI production builds (`next start`) would
 * otherwise throw. It fails open with a log, so a BotID outage never blocks a paying customer.
 * The client side is src/instrumentation-client.ts; the forms submit with fetch (ProtectedForm), since
 * BotID cannot attach its headers to native form posts.
 */
export async function isBotRequest(): Promise<boolean> {
  if (process.env.VERCEL !== "1") return false;
  try {
    return (await checkBotId()).isBot;
  } catch (e) {
    console.error("[access] BotID check failed, request allowed:", (e as Error).message);
    return false;
  }
}
