/** Short, honest event-type list for the request context (free text is not needed before payment). */
export const EVENT_TYPES: { id: string; label: string }[] = [
  { id: "school-carnival", label: "School carnival or fundraiser" },
  { id: "church-festival", label: "Church or community festival" },
  { id: "company-event", label: "Company picnic or employee event" },
  { id: "city-festival", label: "City festival, fair or street fair" },
  { id: "private-party", label: "Birthday, graduation or private party" },
  { id: "wedding", label: "Wedding or celebration" },
  { id: "grand-opening", label: "Grand opening or promotion" },
  { id: "other", label: "Something else" },
];

/** "school carnival or fundraiser"; null for "other" or unknown ids (the email then just says "event"). */
export const eventTypeNoun = (id: string | null): string | null => {
  const t = id && id !== "other" ? EVENT_TYPES.find((e) => e.id === id) : null;
  return t ? t.label.charAt(0).toLowerCase() + t.label.slice(1) : null;
};
