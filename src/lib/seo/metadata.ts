import type { Metadata } from "next";
import { BRAND } from "../config";
import type { GateResult } from "./publication";
import { canonicalUrl } from "./routes";

/** One place that turns a canonical path + gate into page metadata. */
export function seoMetadata(opts: { path: string; title: string; description: string; gate: GateResult }): Metadata {
  return {
    title: `${opts.title} | ${BRAND.name}`,
    description: opts.description,
    alternates: { canonical: canonicalUrl(opts.path) },
    robots: opts.gate.indexable ? { index: true, follow: true } : { index: false, follow: false },
  };
}
