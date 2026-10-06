# Operator program (founder decision 2026-10-06: discovery and access, not a payment marketplace)

This file replaces the earlier "operators list rides, set prices, get paid through Stripe Connect" program. That model is retired. Anything below about payouts, commission, Stripe Connect, booking acceptance or payment-ready badges that survives elsewhere in the repo is stale and should be removed when found.

## The offer to operators

- **Listing is free.** No commission, no fee on the rental, no payout onboarding.
- **Customers contact you directly.** A customer who buys Event Access sees your company name, contact person, phone, email and website, then calls or emails you. Price, availability, contract, insurance and payment are between you and the customer.
- **You control your inventory.** Claim the company account we created for you, or create one; add and edit rides, upload photos, set service states, keep your contact details current; remove any ride or your whole company on request.
- **We never resell your contact details as a list.** Access is sold per event, capped per pass, and every reveal is logged.

## The operator workflow

1. Create an account or log in (Sharetribe account: email verification and password reset are Sharetribe's).
2. Claim the imported company (ownership check: an email at the company's website domain, or a founder-recorded manual check; `npm run ops:claim`).
3. See existing rides.
4. Add or edit a ride (title, description, class, facts from the contract; `own_listings/*`).
5. Upload photos (`images/upload`).
6. Edit service states and home base.
7. Edit contact information (stored in the account's private data; never public).
8. Submit/publish → `pendingApproval` → the team approves.

Sharetribe handles 1, 3, 4, 5, 6 and 8 natively. 2 and 7 are ours (the claim script today; a self-serve portal later). Operators are never shown Stripe Connect, payout setup, commission, payment-ready badges or booking eligibility.

## What stays private

The company name, contact person, phone, email, website and exact address are in Sharetribe `privateData` / `protectedData` (server-readable only) and are revealed to customers only through a valid access pass. The public profile stays "Carnival Ride Rental operator" even after a claim, so the hosted Sharetribe pages can't bypass the paywall. Console → Access control → private marketplace keeps the hosted web app from being a public catalogue (founder action; see `LAUNCH_STATUS.md`).

## Verified Sharetribe facts (docs checked 2026-10-06)

| Fact | Source |
|---|---|
| Listings publish without a Stripe account; the API's only publish failure is a permission 403. | [create](https://www.sharetribe.com/api-reference/marketplace.html#create-listing), [publish](https://www.sharetribe.com/api-reference/marketplace.html#publish-draft-listing) |
| "Payout details required before publishing" is a listing-type toggle; Free-messaging providers don't need payout details. | [help](https://www.sharetribe.com/help/en/articles/8940366-what-are-payout-details#h_53357dd6c0), [listing types](https://www.sharetribe.com/help/en/articles/8413295-how-listing-types-work#h_50a2864b44) |
| "You can absolutely use Sharetribe without using Stripe." | [FAQ](https://www.sharetribe.com/docs/concepts/payments/payments-overview/#can-i-use-sharetribe-and-not-use-stripe) |
| User privateData/protectedData never appear in public Marketplace API resources; the Integration API returns them. | [users](https://www.sharetribe.com/api-reference/marketplace.html#users), [integration user](https://www.sharetribe.com/api-reference/integration.html#user-resource-format) |
| Pricing (from 1 Oct 2026): Build $39/month, Live $259/month ($199 annual), usage credits, no transaction fees. | [pricing](https://www.sharetribe.com/pricing/) |

## Page copy source

`src/lib/operators/program.ts` holds the numbers the `/operators` page may state (listing fee 0, commission none). The page's copy is not founder-approved for indexing (`copyApproved: false`).
