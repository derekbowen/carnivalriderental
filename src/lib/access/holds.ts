/**
 * Operators held out of Event Access matching until someone confirms they are still operating
 * (founder decision 2026-10-18). A held operator's listings stay published and browsable; they are
 * simply never counted, offered or sold. Keyed by the same opaque operator key as the public
 * snapshot (src/lib/inventory/operators.json: a truncated hash of the Sharetribe author id), so this
 * file names no company and cannot be reversed into an account.
 *
 * To release a hold, delete its line (and note who confirmed the operator is active, and how).
 */
import crypto from "node:crypto";

export const OPERATOR_HOLDS: Readonly<Record<string, string>> = {
  "9de3757d2e45": "possibly inactive: national gap audit 2026-10-06 found no 2025-26 activity; confirm before selling",
};

/** Same key as scripts/inventory-operators.ts. */
export const operatorKey = (authorId: string) => crypto.createHash("sha256").update(`operator:${authorId}`).digest("hex").slice(0, 12);

export const isHeldOperator = (authorId: string) => Object.hasOwn(OPERATOR_HOLDS, operatorKey(authorId));
