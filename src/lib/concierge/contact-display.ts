/**
 * How an unlocked operator contact is shown in the chat and on /concierge (client-safe, no data
 * access). Only fields the pass already revealed; labels instead of raw keys, links where useful.
 */
export interface ContactRow {
  label: string;
  value: string;
  href?: string;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function contactRows(contact: Record<string, unknown>): ContactRow[] {
  const rows: ContactRow[] = [];
  const company = str(contact.companyName), person = str(contact.contactName), phone = str(contact.phone), email = str(contact.email), website = str(contact.website);
  if (company) rows.push({ label: "Company", value: company });
  if (person) rows.push({ label: "Contact", value: person });
  if (phone) rows.push({ label: "Phone", value: phone, href: `tel:${phone.replace(/[^\d+]/g, "")}` });
  if (email) rows.push({ label: "Email", value: email, href: `mailto:${email}` });
  if (website) rows.push({ label: "Website", value: website, href: /^https?:\/\//i.test(website) ? website : `https://${website}` });
  const based = [str(contact.hqCity), str(contact.hqState)].filter(Boolean).join(", ");
  if (based) rows.push({ label: "Based in", value: based });
  return rows;
}
