/**
 * The operator program (operators list their own rides, set their own price, get paid out by
 * Stripe). Founder-requested 2026-10-04. NOTHING transactional exists yet: the page collects
 * early-access applications only. See docs/OPERATOR_MARKETPLACE.md.
 *
 * Every number shown on the operator page comes from here, so the page cannot drift from the
 * decision. Console commission (Monetization → Commission) must be set to match before launch.
 */
export const OPERATOR_PROGRAM = {
  status: "early-access" as "early-access" | "live",
  /** Operator (provider) commission in percent. The page promises "0%": keep this at 0 or rewrite the page. */
  operatorCommissionPct: 0,
  /** Customer service fee in percent, added on top of the operator's price. null = not decided; the page says so. */
  customerServiceFeePct: null as number | null,
  /** Founder approval of the page copy. Until true the page is never indexable. */
  copyApproved: false,
} as const;
