import { paymentsMode } from "../config";
import { sharetribeConnection } from "./sharetribe";

/**
 * Honest integration status for the internal console. "Connected" is reported only
 * after a verified API round-trip, never from the mere presence of env vars.
 */
export interface IntegrationStatus {
  name: string;
  label: string;
  tone: "ok" | "neutral" | "bad";
  detail: string;
}

export async function integrationStatuses(): Promise<IntegrationStatus[]> {
  const st = await sharetribeConnection();
  return [
    {
      name: "Sharetribe",
      label:
        st.state === "connected-readonly"
          ? `read-only connected · ${st.marketplaceName}${st.marketplaceApi === "verified" ? " · both APIs" : ""}`
          : st.state === "not-configured"
            ? "not configured"
            : "check failed",
      tone: st.state === "connected-readonly" ? "ok" : st.state === "error" ? "bad" : "neutral",
      detail: `${st.detail} Marketplace API client: ${st.marketplaceApi}. (checked ${st.checkedAt.slice(0, 16).replace("T", " ")} UTC)`,
    },
    {
      name: "Payments",
      label: `${paymentsMode()} adapter (not connected)`,
      tone: "neutral",
      detail: "Payment states are recorded manually for demonstration; no card data is collected and no money moves.",
    },
    { name: "Email / notifications", label: "not configured", tone: "neutral", detail: "No messages are sent to customers or operators from this build." },
  ];
}
