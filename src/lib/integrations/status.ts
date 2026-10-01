import { paymentsMode } from "../config";

/**
 * Honest integration status for display in the internal console.
 * Nothing here calls an external service. Presence of an env var is NOT reported
 * as "connected" — only a verified round-trip could justify that, and none exists yet.
 */
export interface IntegrationStatus {
  name: string;
  state: "development-adapter" | "not-configured";
  detail: string;
}

export function integrationStatuses(): IntegrationStatus[] {
  return [
    {
      name: "Sharetribe",
      state: "development-adapter",
      detail:
        "Not connected. Requests, quotes and statuses live in the local development store. See docs/SHARETRIBE_MAPPING.md for the planned mapping.",
    },
    {
      name: "Payments (Stripe via Sharetribe)",
      state: "development-adapter",
      detail: `Mode: ${paymentsMode()}. Payment states are recorded manually for demonstration; no card data is collected and no money moves.`,
    },
    {
      name: "Email / customer notifications",
      state: "not-configured",
      detail: "No messages are sent to customers or operators from this build.",
    },
  ];
}
