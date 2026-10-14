# iOS + Android app (Capacitor wrapper)

Plan: once the web build is live, wrap it with Capacitor for iOS and Android. This note says what the web side already does for that and what the wrapper project must handle.

## How the app loads the site

This app needs a server: SSR/ISR pSEO pages, `/api/*` routes, middleware and the request store. So it **cannot** be a static export bundled into the app. The Capacitor shell loads the hosted production site:

```ts
// capacitor.config.ts (in the wrapper project, later)
server: { url: "https://<production domain>", cleartext: false }
```

So every web release ships to the app instantly, with no app-store review for content or pricing changes.

## Already done in the web build (tested in `e2e/mobile.spec.ts`)

- `viewport-fit=cover` + `theme-color`: the page draws edge to edge under the notch.
- Safe-area padding: the sticky header clears the status bar or notch, the footer clears the home indicator, and the side insets cover landscape.
- Inputs are 16px, so iOS doesn't zoom in when a field is tapped.
- The mobile menu button is a 44×44 tap target.
- No sideways scrolling at 390 px on the key pages.
- Forms post JSON and use `sessionStorage` only, which works in WKWebView and Android WebView.
- `min-h-dvh`, so the mobile browser and WebView toolbar can't overflow the layout.

## Must-dos in the wrapper project

1. **No Basic-auth screens in the app.** WebViews don't show password prompts. The app must point at a host with `SITE_ACCESS_PASSWORD` **unset**. Never ship the team console (`/internal`) in the app.
2. **App Store guideline 4.2 (minimum functionality):** Apple rejects apps that only repackage a website. Plan at least one native feature, e.g.:
   - push notifications for request and booking status;
   - native share for ride pages;
   - operators: camera upload for ride photos.
3. **Payments:** event ride rentals are physical services used outside the app, so Stripe card checkout is allowed (no in-app purchase). Card entry must stay in Stripe's own fields (project rule). Test Stripe 3-D Secure pop-ups inside the WebView, and check whether Apple Pay works in the wrapped app before relying on it.
4. **Links:** open `tel:`, `mailto:`, maps and external sites in the system apps or browser, not inside the WebView.
5. **Offline:** show a native "no connection" screen. A remote-URL app shows nothing without network.
6. **Deep links:** map `https://<domain>/…` (universal links / app links) so pSEO URLs open in the app when it's installed.
7. Splash screen and icons need the final logo.

## Not done

- No Capacitor project, native code or store listings yet.
- No push-notification backend.
