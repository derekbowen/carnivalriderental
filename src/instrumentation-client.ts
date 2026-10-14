import { initBotId } from "botid/client/core";

// Vercel BotID: attaches its challenge headers to these fetch POSTs (src/components/access/ProtectedForm.tsx);
// the routes verify them with isBotRequest() (src/lib/access/bot.ts). The Stripe webhook and the Checkout
// return URL are deliberately not listed: Stripe must always reach them.
initBotId({
  protect: [
    { path: "/api/access/start", method: "POST" },
    { path: "/api/access/checkout", method: "POST" },
    { path: "/api/access/alternative", method: "POST" },
    { path: "/api/access/manual-search", method: "POST" },
    { path: "/api/access/save-search", method: "POST" },
    { path: "/api/pass/recover", method: "POST" },
  ],
});
