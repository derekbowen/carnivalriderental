// Client-safe (the event form imports it): no imports.
/**
 * What one purchase delivers for a search with `matched` contactable operators (founder decision
 * 2026-10-17): we sell from `minimumMatches` up, so general copy says "up to" the unlock limit and
 * every per-search surface states the real number. Never promise the limit where fewer match.
 */
export const contactsIncluded = (unlockLimit: number, matched: number) => Math.max(0, Math.min(unlockLimit, matched));

/** "all 3 matching operators" when the limit covers everyone, else "5 of the 13 matching operators, chosen by you". */
export function contactsPhrase(unlockLimit: number, matched: number): string {
  if (matched > unlockLimit) return `${unlockLimit} of the ${matched} matching operators, chosen by you`;
  return matched === 1 ? "the 1 matching operator" : `all ${matched} matching operators`;
}
