import { checkInternalAuth } from "@/lib/internal-auth";
import { RuleError } from "@/lib/requests/repo";

/** Wraps an internal route: re-checks auth (defense in depth) and maps rule errors. */
export function internalRoute<A extends unknown[]>(
  fn: (req: Request, actor: string, ...args: A) => Promise<Response> | Response,
) {
  return async (req: Request, ...args: A): Promise<Response> => {
    const auth = checkInternalAuth(req.headers.get("authorization"));
    if (!auth.ok) return Response.json({ error: "unauthorized" }, { status: auth.status });
    try {
      return await fn(req, `team:${auth.user}`, ...args);
    } catch (e) {
      if (e instanceof RuleError) return Response.json({ error: e.code, message: e.message }, { status: e.httpStatus });
      console.error("[internal] failed", e instanceof Error ? e.message : e);
      return Response.json({ error: "failed", message: "That change was not saved." }, { status: 503 });
    }
  };
}

export async function jsonBody(req: Request): Promise<Record<string, unknown>> {
  const b = await req.json().catch(() => null);
  return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
}
