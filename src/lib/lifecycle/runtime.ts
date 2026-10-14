/** Production wiring for lifecycle email: config, the email API sender, the site URL and the optional AI step. */
import { siteUrl } from "../config";
import { emailConfig } from "../email/config";
import { senderFor } from "../email/outbox";
import { gatewayPersonalizer } from "./ai";
import type { LifecycleDeps } from "./engine";

export function lifecycleDeps(env: Record<string, string | undefined> = process.env): LifecycleDeps {
  const cfg = emailConfig(env);
  return { cfg, send: cfg.apiKey ? senderFor(cfg) : null, siteUrl: siteUrl(), personalize: gatewayPersonalizer(env) };
}
