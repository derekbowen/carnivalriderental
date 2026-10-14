/**
 * The one AI model this site uses through Vercel AI Gateway (founder decision 2026-10-14): Claude,
 * the same model as lifecycle email (LIFECYCLE_AI_MODEL). On Vercel the gateway authenticates with
 * the deployment's OIDC token; AI_GATEWAY_API_KEY works elsewhere. No other provider is a default.
 */
export const DEFAULT_GATEWAY_MODEL = "anthropic/claude-haiku-5.5";

/** Chat concierge model: CONCIERGE_MODEL, else the lifecycle model, else the Claude default. */
export function conciergeModel(env: Record<string, string | undefined> = process.env): string {
  return env.CONCIERGE_MODEL || env.LIFECYCLE_AI_MODEL || DEFAULT_GATEWAY_MODEL;
}
