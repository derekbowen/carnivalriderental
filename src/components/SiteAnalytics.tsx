"use client";
import { Analytics, type BeforeSendEvent } from "@vercel/analytics/react";
import { analyticsUrl } from "@/lib/analytics";

// The plain React integration (not /next): it reports only the URL, which analyticsUrl redacts.
const beforeSend = (event: BeforeSendEvent): BeforeSendEvent | null => {
  const url = analyticsUrl(event.url);
  return url ? { ...event, url } : null;
};

/** Cookieless page-view counts, traffic sources and campaign tags (Vercel Web Analytics). */
export function SiteAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}
