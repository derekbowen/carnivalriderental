"use client";

import { useState, type FormEvent, type ReactNode } from "react";

/**
 * A form that posts with fetch so Vercel BotID can attach its headers (it cannot to native form posts),
 * then follows the route's answer: the routes reply `{ location }` to `Accept: application/json`
 * requests and keep their 303 redirects for everything else. Without JavaScript the form still posts
 * natively to the same action.
 */
export function ProtectedForm({ action, className, children, testId }: { action: string; className?: string; children: ReactNode; testId?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(action, { method: "POST", body: new FormData(e.currentTarget), headers: { Accept: "application/json" } });
      const body = (await res.json().catch(() => null)) as { location?: string } | null;
      if (body?.location) {
        window.location.assign(body.location);
        return;
      }
      setError(res.status === 429 ? "Too many attempts. Please wait a few minutes and try again." : "Something went wrong. Please try again, or email support@carnivalriderental.us.");
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <form method="post" action={action} className={className} onSubmit={onSubmit} aria-busy={busy} data-testid={testId}>
      {children}
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-pop/40 bg-pop/10 px-4 py-3 text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
