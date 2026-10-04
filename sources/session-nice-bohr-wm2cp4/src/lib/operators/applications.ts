import { randomUUID } from "node:crypto";
import { z } from "zod";
import { US_STATE_CODES } from "../contract";
import type { Db } from "../requests/db";

/**
 * Early-access applications from ride operators. Internal only (shown in the team console);
 * nothing here creates a marketplace account or a listing, and nobody is contacted automatically.
 */
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const stateCode = z.string().trim().toLowerCase().refine((c) => US_STATE_CODES.includes(c), "unknown state");

/** "TX, ok;LA" → ["tx","ok","la"]; anything that is not a state code fails validation. */
const stateList = z
  .string()
  .trim()
  .max(300)
  .transform((s) => [...new Set(s.split(/[^A-Za-z]+/).filter(Boolean).map((c) => c.toLowerCase()))])
  .pipe(z.array(stateCode));

export const operatorApplicationSchema = z
  .object({
    companyName: text(2, 120),
    contactName: text(2, 120),
    email: z.string().trim().toLowerCase().email().max(200),
    phone: z.string().trim().regex(/^\+?[0-9 ().-]{7,25}$/, "enter a phone number"),
    homeState: stateCode,
    statesServed: stateList.optional().default(""),
    rides: text(3, 2000),
    website: z.string().trim().max(200).optional().default(""),
    consent: z.literal(true, { errorMap: () => ({ message: "consent is required" }) }),
    /** Honeypot: hidden from people, filled by bots. */
    fax: z.string().max(200).optional().default(""),
  })
  .strict();

export type OperatorApplicationInput = z.input<typeof operatorApplicationSchema>;
export type OperatorApplication = Omit<z.output<typeof operatorApplicationSchema>, "fax" | "consent">;

export interface StoredApplication {
  id: string;
  application: OperatorApplication;
  status: "new";
  submissions: number;
  createdAt: string;
  updatedAt: string;
}

export class OperatorApplications {
  constructor(private db: Db) {}

  /** Upsert by email: a resubmission updates the same row instead of duplicating it. */
  save(app: OperatorApplication): StoredApplication {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO operator_applications (id, email, payload_json, status, submissions, created_at, updated_at)
         VALUES (?, ?, ?, 'new', 1, ?, ?)
         ON CONFLICT(email) DO UPDATE SET payload_json = excluded.payload_json, submissions = submissions + 1, updated_at = excluded.updated_at`,
      )
      .run(randomUUID(), app.email, JSON.stringify(app), now, now);
    return this.byEmail(app.email)!;
  }

  byEmail(email: string): StoredApplication | undefined {
    const row = this.db.prepare(`SELECT * FROM operator_applications WHERE email = ?`).get(email) as Row | undefined;
    return row && toStored(row);
  }

  list(): StoredApplication[] {
    return (this.db.prepare(`SELECT * FROM operator_applications ORDER BY created_at DESC`).all() as unknown as Row[]).map(toStored);
  }
}

interface Row {
  id: string;
  payload_json: string;
  status: "new";
  submissions: number;
  created_at: string;
  updated_at: string;
}

const toStored = (r: Row): StoredApplication => ({
  id: r.id,
  application: JSON.parse(r.payload_json),
  status: r.status,
  submissions: r.submissions,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export type SubmitResult =
  | { status: 201; body: { ok: true } }
  | { status: 400; body: { ok: false; error: "validation"; fields: Record<string, string> } };

/** HTTP-shaped handler (kept framework-free for unit tests). */
export function submitOperatorApplication(body: unknown, store: OperatorApplications): SubmitResult {
  const parsed = operatorApplicationSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0] ?? "form")] ??= i.message;
    return { status: 400, body: { ok: false, error: "validation", fields } };
  }
  const { fax, consent: _consent, ...app } = parsed.data;
  // Bots get the same success response, and nothing is stored.
  if (!fax) store.save(app);
  return { status: 201, body: { ok: true } };
}
