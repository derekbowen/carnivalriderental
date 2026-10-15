# Security scan of carnivalriderental.us (2026-10-15)

Vibe App Scanner, scan `06c0742d-b3cf-4dbe-bf16-e8bd47c651b9`, unauthenticated, 10 URLs. No critical or high findings; 5 medium, 5 low, 3 informational. This note records what was done about each and what is left for the founder (DNS lives in Cloudflare, which the repo cannot reach).

## Done in the app

| Finding | Action |
|---|---|
| Missing `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` | Added on every response in `next.config.ts` (`nosniff`, `SAMEORIGIN`, `strict-origin-when-cross-origin`, `camera=(), microphone=(), geolocation=()`). `e2e/headers.spec.ts` checks them. |
| Missing `Content-Security-Policy` | `frame-ancestors 'self'` is enforced (stops clickjacking; cannot break anything). A script/style policy is **not** set: Next.js hydration, BotID and Speed Insights use inline scripts, so it needs nonces and a report-only rollout with a report endpoint first. Separate change. |
| Homepage missing `og:image` | The homepage's `openGraph` block overrode the layout's and dropped the image; shared links had no preview. Fixed in `src/app/page.tsx`. |
| `.eyebrow` colour contrast (4.0:1) | New `--color-pop-strong` (#c2281f, 5.5:1 on the canvas) for eyebrow text; `--color-pop` stays for non-text accents. |
| No accessibility statement | `/accessibility` (noindex, like the other legal pages), linked from the footer. It claims only what is true: WCAG 2.1 AA as the target, automated and keyboard checks, known gaps. |
| Unsized class photos on the homepage | `width`/`height` on the lazy-loaded class photos. |

## Not changed, on purpose

| Finding | Why |
|---|---|
| `/s` missing title, description, canonical, JSON-LD, Open Graph | False positive: the scanner was blocked by Vercel's security checkpoint on that request and read the challenge page. `/s` serves a title, description and share image, and is `noindex` on purpose (search results). |
| `/events` is `noindex` | Intentional. Indexing is gated by `PUBLIC_INDEXING`, the pilot allowlist and `PSEO_INVENTORY.copyApproved` (`docs/PSEO_INDEXING_PLAN.md`); a scanner finding does not authorise indexing. |
| Missing `Cross-Origin-Resource-Policy` | `same-origin` would stop other origins loading our images. Lifecycle emails embed ride thumbnails and some webmail clients load images from the page's origin, so this could blank them. Low value, real risk. |
| HSTS `includeSubDomains` / `preload` | Vercel already sends a 2-year `max-age`. `includeSubDomains` commits every subdomain (including mail-related ones) to HTTPS and `preload` is near-irreversible. Founder decision, not a scan fix. |

## For the founder: DNS in Cloudflare

The scanner found DMARC `v=DMARC1; p=none;` with no report address, and no SPF on the bare domain. Per `docs/EMAIL.md`, Emailit and Resend each send from their own subdomains with DKIM and SPF there, so the bare domain's records govern anyone *else* sending as `@carnivalriderental.us`.

1. **SPF on the bare domain** (`TXT @`). If no mailbox provider sends as `support@carnivalriderental.us` directly: `v=spf1 -all`. If one does (Google Workspace, Zoho, Outlook), use its include, e.g. `v=spf1 include:_spf.google.com -all`. Check before publishing: a wrong SPF bounces your own mail.
2. **DMARC with reports** (`TXT _dmarc`): `v=DMARC1; p=quarantine; rua=mailto:dmarc@carnivalriderental.us; adkim=r; aspf=r`. The `dmarc@` address must exist (inbound is Resend). Watch the reports for two weeks; if only Emailit and Resend show up as sources and pass, move to `p=reject`.
3. **CAA** (optional): Vercel issues certificates through Let's Encrypt. Before adding `CAA 0 issue "letsencrypt.org"`, open the padlock in the browser and confirm the current certificate's issuer; a CAA record that omits the real issuer blocks renewal.
4. **DNSSEC** (optional): Cloudflare → DNS → Settings → Enable DNSSEC, then add the DS record at the registrar.

## Badge

The scanner offers an "Audited by VAS" badge (an image and link hosted on vibeappscanner.com). Adding third-party content to the footer is a founder decision; it is not in the repo until approved.
