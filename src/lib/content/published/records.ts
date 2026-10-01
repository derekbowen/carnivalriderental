import type { ContentSet } from "../types";

/**
 * Publishable records. Intentionally empty in session one: nothing has been
 * verified yet. Records added here must pass src/lib/content/integrity.ts and the
 * publication gates in src/lib/seo/publication.ts before they become indexable.
 */
export const publishedContent: ContentSet = {
  categories: [],
  rides: [],
  locations: [],
  coverage: [],
};
