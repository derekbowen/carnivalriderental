/** Browser-safe helpers for the request form (no Node imports). */

/** Client-side interpretation of the create response. Shared so it can be unit-tested. */
export function interpretCreateResponse(status: number, body: unknown): { ok: true; statusUrl: string; reference: string } | { ok: false; message: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  if ((status === 201 || status === 200) && b.ok === true && b.persisted === true && typeof b.statusUrl === "string" && typeof b.reference === "string") {
    return { ok: true, statusUrl: b.statusUrl, reference: b.reference };
  }
  if (status === 400 && Array.isArray(b.issues)) {
    const first = (b.issues as { message?: string }[])[0]?.message;
    return { ok: false, message: first ? `Please check your answers: ${first}` : "Please check your answers." };
  }
  return { ok: false, message: typeof b.message === "string" ? b.message : "We could not save your request. Nothing was submitted. Please try again." };
}
