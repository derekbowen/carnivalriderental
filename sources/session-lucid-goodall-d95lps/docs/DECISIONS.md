# Decisions needed before real transactions

None of these are decided. The code refuses to confirm a booking until the payment policy is approved (`CONFIRMATION_PAYMENT_POLICY` in `src/lib/requests/status.ts`).

## Payment policy
1. **What the customer commits when accepting a quote**: save a card only, pay a deposit, or pay in full?
2. **Deposit amount** (fixed or %), and whether it is refundable.
3. **When the balance is charged** (e.g. N days before the event) and what happens if that charge fails.
4. **Cancellation and refund terms**, by how far ahead of the event.
5. **What happens if no operator commits** after the customer pays (full refund timeline).

Constraints from the platform (see ARCHITECTURE.md): card authorizations last 7 days; the default negotiation process charges immediately and auto-cancels after 75 days; saved cards allow later off-session charges that can fail.

## Seller of record and money flow
6. Confirm the **seller-of-record model** (our company as the single provider) with Stripe/Sharetribe support, an accountant and a lawyer.
7. **Supplier payment terms** (deposit to operator, balance timing), paid outside the marketplace transaction.
8. Commission setting for our own provider account (probably none).

## Content and brand
9. Final **brand name and domain**.
10. **Image rights**: which photos we own or license (Ferris Wheel Rental U.S. archive?).
11. Who reviews and approves catalog records for publication.

## Repository
12. `derekbowen/carnivalriderental` is **public**. The brief asks for non-public development. Consider making it private (Settings → General → Danger zone → Change visibility).
